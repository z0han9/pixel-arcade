(function () {
  const BRICK_ROWS = 10;
  const BRICK_COLS = 12;
  const BRICK_HEIGHT = 20;
  const BRICK_GAP = 5;
  const BRICK_SIDE_MARGIN = 20;
  const BRICK_TOP_OFFSET = 56;

  const PADDLE_WIDTH = 100;
  const PADDLE_HEIGHT = 14;
  const PADDLE_BOTTOM_MARGIN = 40;
  const PADDLE_SPEED = 0.6; // px/ms

  const BALL_RADIUS = 8;
  const BALL_SPEED_START = 0.45; // px/ms
  const BALL_SPEED_MAX = 0.9; // px/ms, reached after ~112 bricks hit
  const BALL_SPEED_INCREMENT = 0.004; // per brick hit
  const LAUNCH_SPREAD = 0.3; // radians either side of straight up
  const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60 degrees, paddle-edge hits

  const START_LIVES = 3;
  const TRAIL_LENGTH = 9;
  const PADDLE_KICK_MS = 140;

  const HEART = [
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...'
  ];

  const ICON = [
    'RRR.RRR.RRR.',
    'RRR.RRR.RRR.',
    '............',
    '.YYY.YYY.YYY',
    '.YYY.YYY.YYY',
    '............',
    '............',
    '.....WW.....',
    '.....WW.....',
    '............',
    '..PPPPPPPP..',
    '............'
  ];

  const { clamp, circleRectOverlap } = window.ArcadeUtils;

  function createBreakoutGame() {
    let ctx, width, height;
    let paddle, ball, bricks, lives, score, isOver, waitingToLaunch, ballSpeed;
    let time, trail, paddleKick, lifeLostT;
    let colors, rowColors, backdrop, heartPalette, heartPaletteOff;
    const fx = window.ArcadeFx.createEmitter();
    const shake = window.ArcadeFx.createShake();

    function loadColors() {
      const T = window.ArcadeTheme;
      colors = {
        bg: T.get('--bg-game'),
        line: T.alpha(T.get('--border-default'), 0.45),
        star: T.alpha(T.get('--text-primary'), 0.55),
        accent: T.get('--bricks-accent'),
        accent2: T.get('--bricks-accent-2'),
        danger: T.get('--color-danger'),
        text: T.get('--text-secondary'),
        white: T.get('--text-primary'),
        dark: T.get('--bg-app')
      };
      // warm -> cool -> pink ramp, all taken from the Pixel Arcade palette
      rowColors = [
        T.get('--color-danger'), T.get('--bricks-accent-2'), T.get('--peach'), T.get('--bricks-accent'),
        T.get('--color-warning'), T.get('--snake-accent-2'), T.get('--snake-accent'), T.get('--flappy-accent'),
        T.get('--2048-accent'), T.get('--flappy-accent-2')
      ];
      heartPalette = { R: colors.danger };
      heartPaletteOff = { R: T.alpha(T.get('--border-default'), 0.9) };
    }

    function buildBackdrop() {
      backdrop = window.ArcadeUtils.createLayer(ctx, width, height, (g) => {
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, width, height);
        g.fillStyle = colors.line;
        for (let y = height - 200; y < height; y += 40) g.fillRect(0, y, width, 1);
        for (let x = 0; x < width; x += 40) g.fillRect(x, height - 200, 1, 200);
        g.fillStyle = colors.star;
        let seed = 7;
        for (let i = 0; i < 38; i++) {
          seed = (seed * 9301 + 49297) % 233280;
          const sx = Math.floor((seed / 233280) * width);
          seed = (seed * 9301 + 49297) % 233280;
          const sy = Math.floor((seed / 233280) * (height - 220));
          g.fillRect(sx, sy, 2, 2);
        }
      });
    }

    function buildBricks() {
      const areaWidth = width - BRICK_SIDE_MARGIN * 2;
      const brickWidth = (areaWidth - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
      const list = [];
      for (let row = 0; row < BRICK_ROWS; row++) {
        for (let col = 0; col < BRICK_COLS; col++) {
          list.push({
            x: BRICK_SIDE_MARGIN + col * (brickWidth + BRICK_GAP),
            y: BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_GAP),
            w: brickWidth,
            h: BRICK_HEIGHT,
            row,
            alive: true
          });
        }
      }
      return list;
    }

    function placeBallOnPaddle() {
      waitingToLaunch = true;
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
      ball.vx = 0;
      ball.vy = 0;
      trail.length = 0;
    }

    function reset() {
      paddle = {
        x: (width - PADDLE_WIDTH) / 2,
        y: height - PADDLE_BOTTOM_MARGIN,
        w: PADDLE_WIDTH,
        h: PADDLE_HEIGHT
      };
      ball = { x: 0, y: 0, vx: 0, vy: 0, r: BALL_RADIUS };
      bricks = buildBricks();
      lives = START_LIVES;
      score = 0;
      isOver = false;
      ballSpeed = BALL_SPEED_START;
      time = 0;
      trail = [];
      paddleKick = 0;
      lifeLostT = 0;
      fx.clear();
      placeBallOnPaddle();
    }

    function init(context, w, h) {
      ctx = context;
      width = w;
      height = h;
      loadColors();
      buildBackdrop();
      reset();
    }

    function launchBall() {
      waitingToLaunch = false;
      const spread = (Math.random() * 2 - 1) * LAUNCH_SPREAD;
      ball.vx = ballSpeed * Math.sin(spread);
      ball.vy = -ballSpeed * Math.cos(spread);
    }

    function onInput(action) {
      if (isOver) return;
      if (action === 'ACTION' && waitingToLaunch) launchBall();
    }

    function movePaddle(dt) {
      const pointerX = window.ArcadeInput.getPointerX();
      if (pointerX !== null) {
        paddle.x = pointerX - paddle.w / 2;
      } else {
        if (window.ArcadeInput.isHeld('LEFT')) paddle.x -= PADDLE_SPEED * dt;
        if (window.ArcadeInput.isHeld('RIGHT')) paddle.x += PADDLE_SPEED * dt;
      }
      paddle.x = clamp(paddle.x, 0, width - paddle.w);
    }

    function resolveBrickCollision(prevY) {
      for (let i = 0; i < bricks.length; i++) {
        const b = bricks[i];
        if (!b.alive) continue;
        if (!circleRectOverlap(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h)) continue;

        b.alive = false;
        const points = (BRICK_ROWS - b.row) * 10;
        score += points;

        const color = rowColors[b.row % rowColors.length];
        fx.burst(b.x + b.w / 2, b.y + b.h / 2, [color, window.ArcadeTheme.shade(color, 0.35), colors.white], 9, {
          speed: 0.28, size: 5, life: 560, gravity: 0.0009
        });
        if (b.row < 3) fx.float(b.x + b.w / 2, b.y, '+' + points, colors.accent);

        const cameFromAbove = prevY + ball.r <= b.y;
        const cameFromBelow = prevY - ball.r >= b.y + b.h;
        if (cameFromAbove || cameFromBelow) ball.vy *= -1;
        else ball.vx *= -1;

        ballSpeed = Math.min(BALL_SPEED_MAX, ballSpeed + BALL_SPEED_INCREMENT);
        const currentMag = Math.hypot(ball.vx, ball.vy);
        if (currentMag > 0) {
          const scale = ballSpeed / currentMag;
          ball.vx *= scale;
          ball.vy *= scale;
        }

        if (bricks.every((brick) => !brick.alive)) isOver = true;
        break;
      }
    }

    function loseLife() {
      lives -= 1;
      lifeLostT = 600;
      shake.trigger(lives <= 0 ? 8 : 5, lives <= 0 ? 500 : 300);
      fx.burst(ball.x, height - 6, [colors.danger, colors.accent2, colors.white], 18, {
        speed: 0.4, size: 5, life: 650, angle: -Math.PI / 2, spread: Math.PI
      });
      if (lives <= 0) {
        isOver = true;
      } else {
        placeBallOnPaddle();
      }
    }

    function update(dt) {
      time += dt;
      fx.update(dt);
      shake.update(dt);
      paddleKick = Math.max(0, paddleKick - dt);
      lifeLostT = Math.max(0, lifeLostT - dt);
      if (isOver) return;

      movePaddle(dt);

      if (waitingToLaunch) {
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - ball.r - 1;
        return;
      }

      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > TRAIL_LENGTH) trail.shift();

      const prevY = ball.y;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.r <= 0) {
        ball.x = ball.r;
        ball.vx = Math.abs(ball.vx);
        fx.burst(ball.x, ball.y, colors.white, 3, { speed: 0.15, size: 3, life: 220, gravity: 0 });
      } else if (ball.x + ball.r >= width) {
        ball.x = width - ball.r;
        ball.vx = -Math.abs(ball.vx);
        fx.burst(ball.x, ball.y, colors.white, 3, { speed: 0.15, size: 3, life: 220, gravity: 0 });
      }

      if (ball.y - ball.r <= 0) {
        ball.y = ball.r;
        ball.vy = Math.abs(ball.vy);
        fx.burst(ball.x, ball.y, colors.white, 3, { speed: 0.15, size: 3, life: 220, gravity: 0 });
      }

      if (ball.vy > 0 && circleRectOverlap(ball.x, ball.y, ball.r, paddle.x, paddle.y, paddle.w, paddle.h)) {
        const hitPos = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
        const angle = hitPos * MAX_BOUNCE_ANGLE;
        ball.vx = ballSpeed * Math.sin(angle);
        ball.vy = -ballSpeed * Math.cos(angle);
        ball.y = paddle.y - ball.r;
        paddleKick = PADDLE_KICK_MS;
        fx.burst(ball.x, paddle.y, [colors.accent, colors.accent2], 6, {
          speed: 0.22, size: 4, life: 320, angle: -Math.PI / 2, spread: Math.PI * 0.9
        });
      }

      resolveBrickCollision(prevY);
      if (isOver) return;

      if (ball.y - ball.r > height) loseLife();
    }

    function drawBrick(c, b) {
      const T = window.ArcadeTheme;
      const base = rowColors[b.row % rowColors.length];
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      const w = Math.round(b.w);
      const h = b.h;
      c.fillStyle = base;
      c.fillRect(x, y, w, h);
      c.fillStyle = T.shade(base, 0.4);
      c.fillRect(x, y, w, 3);
      c.fillRect(x, y, 3, h);
      c.fillStyle = T.shade(base, -0.32);
      c.fillRect(x, y + h - 3, w, 3);
      c.fillRect(x + w - 3, y, 3, h);
    }

    function drawHearts(c) {
      const scale = 3;
      for (let i = 0; i < START_LIVES; i++) {
        const lost = i >= lives;
        const justLost = lost && i === lives && lifeLostT > 0;
        const pal = lost && !justLost ? heartPaletteOff : heartPalette;
        const jitter = justLost ? Math.round(Math.sin(time / 30) * 2) : 0;
        window.ArcadePixel.draw(c, HEART, pal, 16 + i * 30 + jitter, 14, scale);
      }
    }

    function drawBall(c) {
      for (let i = 0; i < trail.length; i++) {
        const t = (i + 1) / trail.length;
        c.globalAlpha = t * 0.45;
        c.fillStyle = colors.accent2;
        const r = ball.r * (0.35 + 0.55 * t);
        c.fillRect(Math.round(trail[i].x - r), Math.round(trail[i].y - r), Math.round(r * 2), Math.round(r * 2));
      }
      c.globalAlpha = 1;
      const bx = Math.round(ball.x);
      const by = Math.round(ball.y);
      const r = ball.r;
      c.fillStyle = colors.accent;
      c.fillRect(bx - r + 2, by - r, 2 * r - 4, 2 * r);
      c.fillRect(bx - r, by - r + 2, 2 * r, 2 * r - 4);
      c.fillStyle = colors.white;
      c.fillRect(bx - r + 3, by - r + 3, 4, 4);
    }

    function drawPaddle(c) {
      const T = window.ArcadeTheme;
      const kick = paddleKick > 0 ? Math.sin((paddleKick / PADDLE_KICK_MS) * Math.PI) : 0;
      const px = Math.round(paddle.x - kick * 3);
      const pw = Math.round(paddle.w + kick * 6);
      const py = Math.round(paddle.y + kick * 2);
      const ph = paddle.h - Math.round(kick * 2);
      c.fillStyle = colors.accent;
      c.fillRect(px, py, pw, ph);
      c.fillStyle = T.shade(colors.accent, 0.45);
      c.fillRect(px, py, pw, 3);
      c.fillStyle = T.shade(colors.accent, -0.3);
      c.fillRect(px, py + ph - 3, pw, 3);
      c.fillStyle = colors.accent2;
      c.fillRect(px, py, 8, ph);
      c.fillRect(px + pw - 8, py, 8, ph);
      c.fillStyle = T.shade(colors.accent2, 0.4);
      c.fillRect(px, py, 8, 3);
      c.fillRect(px + pw - 8, py, 8, 3);
    }

    function draw(context) {
      context.save();
      const o = shake.offset();
      context.translate(o.x, o.y);
      backdrop.draw(context);

      for (let i = 0; i < bricks.length; i++) {
        if (bricks[i].alive) drawBrick(context, bricks[i]);
      }

      drawPaddle(context);
      drawBall(context);
      fx.draw(context);
      drawHearts(context);

      if (waitingToLaunch && !isOver && Math.floor(time / 500) % 2 === 0) {
        context.font = window.ArcadeTheme.font(10);
        context.fillStyle = colors.text;
        context.textAlign = 'center';
        context.fillText(window.ArcadeI18n.t('breakoutLaunchHint'), width / 2, height - 12);
        context.textAlign = 'left';
      }
      context.restore();
    }

    return {
      id: 'breakout',
      title: 'Арканоид',
      deathMs: 650,
      get score() { return score; },
      get isOver() { return isOver; },
      init,
      update,
      draw,
      onInput,
      reset
    };
  }

  function icon() {
    const T = window.ArcadeTheme;
    return window.ArcadePixel.toSvg(ICON, {
      R: T.get('--bricks-accent-2'),
      Y: T.get('--bricks-accent'),
      W: T.get('--text-primary'),
      P: T.get('--bricks-accent')
    });
  }

  window.ArcadeGames = window.ArcadeGames || new Map();
  window.ArcadeGames.set('breakout', {
    id: 'breakout',
    title: 'Арканоид',
    icon,
    create: createBreakoutGame
  });
})();
