(function () {
  const { clamp, circleRectOverlap } = window.ArcadeUtils;

  const BIRD_RADIUS = 16;
  const BIRD_X_RATIO = 0.28;
  const GRAVITY = 0.0022; // px/ms^2
  const FLAP_VELOCITY = -0.62; // px/ms, upward impulse
  const MAX_FALL_SPEED = 0.9; // px/ms terminal velocity

  const PIPE_WIDTH = 90; // width of the cap (and the collision box of the cap)
  const PIPE_BODY_INSET = 7; // body is narrower than the cap on each side
  const PIPE_CAP_HEIGHT = 22;
  const PIPE_GAP = 230;
  const PIPE_SPEED = 0.25; // px/ms
  const PIPE_SPACING = 420; // horizontal distance between pipe pairs
  const PIPE_EDGE_MARGIN = 90; // keep the gap away from the very top/bottom

  const GROUND_HEIGHT = 40;
  const SPRITE_SCALE = 2;
  const SPRITE_PIVOT = { x: 14, y: 9 }; // body centre inside the bitmap (the tail sticks out to the left)
  const STAR_COUNT = 44;

  // Bird sprite (24x20): outline, brown/salmon head, purple body, cream belly, orange beak and feet.
  const BIRD_PALETTE = {
    K: '#160424', A: '#4b295e', B: '#de8275', C: '#69322b', D: '#ffefe3',
    E: '#a86aff', F: '#e2adff', G: '#d14b73', H: '#ffa366', I: '#ffc6ec'
  };

  const BIRD = [
    '..........KKKKKKKKK.....',
    '.........KIIBBBBIBGK....',
    '........KGIIBBBBBBBGK...',
    '.......KGCCAAAACBBBCK...',
    '.......KCCCADKKAAAAADK..',
    '.......KCCCAKKKAAAAAKK..',
    '......KCCCCAKKKCAHHAKKK.',
    '......KCCCCAAAACAHHAAAK.',
    '......KCCGBBBBBEAAAAEGK.',
    '......KBBBBBBBFEEEEEEBGK',
    '.....KGBBBBCCFEFFEFEFECK',
    '.....KBBBCCBBFFDDDDDFFBK',
    'KKK..KCCCBBAAFDDDDDDDFAK',
    'KCCK.KBBBAAAADDDDDDDDFAK',
    'KCCCKKAAAAAAFDDDDDDDDFAK',
    'KCCCCKAAAAEFFFDDDDDDFEK.',
    '.KCCCKKKKEEEEKKKEEEEKK..',
    '..KKKKKKKEEEK..KEEEK....',
    '.......KHGKKK.KHGKKK....',
    '........KGHGHK.KGHGHK...'
  ];

  // flap frame: legs tucked up
  const BIRD_TUCKED = BIRD.slice(0, 18);

  // rainbow trail, top to bottom, every colour taken from the Pixel Arcade palette
  const TRAIL_TOKENS = [
    '--flappy-accent-2', '--peach', '--color-warning', '--color-success', '--flappy-accent', '--2048-accent'
  ];
  const TRAIL_SLICE = 4;
  const TRAIL_BAND = 4;
  const TRAIL_LENGTH = 190;
  const TRAIL_OFFSET = { x: -22, y: 6 }; // where the trail leaves the bird, relative to its centre

  const ICON = [
    '........CCCC',
    '........CCCC',
    '........CCCC',
    '.......CCCCC',
    '..KKKKK.....',
    '.KBBBBBK....',
    'KBBKKBBHK...',
    'KEEEEEEEK...',
    'KEDDDDEEK...',
    '.KKKKK.CCCCC',
    '........CCCC',
    '........CCCC'
  ];

  function createFlappyGame() {
    let ctx, width, height, groundY;
    let birdX, birdY, birdVy, pipes, score, isOver, started;
    let time, flapAnim, spin, scrollFar, scrollNear, scrollGround;
    let colors, trailColors, backdrop, farCity, nearCity, stars;
    let trail, trailFade, flashPalette;
    const fx = window.ArcadeFx.createEmitter();
    const shake = window.ArcadeFx.createShake();

    function loadColors() {
      const T = window.ArcadeTheme;
      colors = {
        bg: T.get('--bg-game'),
        pipe: T.get('--flappy-accent'),
        pink: T.get('--flappy-accent-2'),
        gold: T.get('--color-warning'),
        white: T.get('--text-primary'),
        dark: T.get('--bg-app'),
        panel: T.get('--bg-panel'),
        border: T.get('--border-default'),
        grass: T.get('--pixel-green'),
        text: T.get('--text-secondary')
      };
      trailColors = TRAIL_TOKENS.map((token) => T.get(token));
      flashPalette = {};
      Object.keys(BIRD_PALETTE).forEach((k) => {
        flashPalette[k] = k === 'K' ? BIRD_PALETTE.K : colors.white;
      });
    }

    function buildCity(color, windowColor, minH, maxH, seed) {
      return window.ArcadeUtils.createLayer(ctx, width, maxH, (g) => {
        let x = 0;
        let s = seed;
        const rand = () => {
          s = (s * 9301 + 49297) % 233280;
          return s / 233280;
        };
        while (x < width) {
          const w = 30 + Math.floor(rand() * 34);
          const h = minH + Math.floor(rand() * (maxH - minH));
          g.fillStyle = color;
          g.fillRect(x, maxH - h, w, h);
          g.fillStyle = windowColor;
          for (let wy = maxH - h + 8; wy < maxH - 6; wy += 12) {
            for (let wx = x + 6; wx < x + w - 6; wx += 10) {
              if (rand() > 0.45) g.fillRect(wx, wy, 3, 4);
            }
          }
          x += w;
        }
      });
    }

    function buildScenery() {
      const T = window.ArcadeTheme;
      backdrop = window.ArcadeUtils.createLayer(ctx, width, height, (g) => {
        const bands = 7;
        const bandH = Math.ceil(groundY / bands);
        for (let i = 0; i < bands; i++) {
          g.fillStyle = T.mix(colors.bg, colors.border, (i / (bands - 1)) * 0.32);
          g.fillRect(0, i * bandH, width, bandH);
        }
      });
      const far = T.mix(colors.panel, colors.border, 0.25);
      const near = T.mix(colors.panel, colors.border, 0.6);
      farCity = buildCity(far, T.alpha(colors.border, 0.9), 70, 150, 11);
      nearCity = buildCity(near, T.alpha(colors.pipe, 0.28), 40, 100, 29);

      stars = [];
      let s = 5;
      for (let i = 0; i < STAR_COUNT; i++) {
        s = (s * 9301 + 49297) % 233280;
        const x = Math.floor((s / 233280) * width);
        s = (s * 9301 + 49297) % 233280;
        const y = Math.floor((s / 233280) * (groundY - 180));
        stars.push({ x, y, phase: (i * 137) % 628 });
      }
    }

    function spawnPipe(x) {
      const minCenter = PIPE_EDGE_MARGIN + PIPE_GAP / 2;
      const maxCenter = groundY - PIPE_EDGE_MARGIN - PIPE_GAP / 2;
      const gapCenter = minCenter + Math.random() * Math.max(0, maxCenter - minCenter);
      pipes.push({ x, gapCenter, passed: false });
    }

    function reset() {
      birdX = width * BIRD_X_RATIO;
      birdY = height / 2;
      birdVy = 0;
      pipes = [];
      score = 0;
      isOver = false;
      started = false;
      time = 0;
      flapAnim = 0;
      spin = 0;
      scrollFar = 0;
      scrollNear = 0;
      scrollGround = 0;
      trail = [];
      trailFade = 1;
      fx.clear();
      spawnPipe(width + PIPE_WIDTH);
    }

    function init(context, w, h) {
      ctx = context;
      width = w;
      height = h;
      groundY = h - GROUND_HEIGHT;
      loadColors();
      buildScenery();
      reset();
    }

    function flap() {
      started = true;
      birdVy = FLAP_VELOCITY;
      flapAnim = 320;
      fx.burst(birdX - 16, birdY + 8, [colors.white, colors.pink, colors.pipe], 5, {
        speed: 0.12, size: 4, life: 360, gravity: 0, angle: Math.PI * 0.85, spread: Math.PI * 0.8
      });
    }

    function onInput(action) {
      if (isOver) return;
      if (action === 'ACTION' || action === 'UP') flap();
    }

    function die() {
      isOver = true;
      birdVy = -0.28;
      shake.trigger(8, 450);
      fx.burst(birdX, birdY, [colors.pink, colors.white, colors.pipe, colors.gold], 22, { speed: 0.42, size: 5, life: 700 });
    }

    function pipeRects(p) {
      const topBottom = p.gapCenter - PIPE_GAP / 2;
      const botTop = p.gapCenter + PIPE_GAP / 2;
      const bodyX = p.x + PIPE_BODY_INSET;
      const bodyW = PIPE_WIDTH - PIPE_BODY_INSET * 2;
      return [
        [bodyX, 0, bodyW, topBottom - PIPE_CAP_HEIGHT],
        [p.x, topBottom - PIPE_CAP_HEIGHT, PIPE_WIDTH, PIPE_CAP_HEIGHT],
        [p.x, botTop, PIPE_WIDTH, PIPE_CAP_HEIGHT],
        [bodyX, botTop + PIPE_CAP_HEIGHT, bodyW, groundY - botTop - PIPE_CAP_HEIGHT]
      ];
    }

    // The trail is a ribbon of recent bird heights that streams backwards at the speed of the world.
    function updateTrail(dt) {
      const ox = birdX + TRAIL_OFFSET.x;
      const oy = birdY + TRAIL_OFFSET.y;
      for (let i = 0; i < trail.length; i++) trail[i].x -= PIPE_SPEED * dt;
      const lastPoint = trail[trail.length - 1];
      if (!lastPoint || lastPoint.x <= ox - TRAIL_SLICE + 1) trail.push({ x: ox, y: oy });
      while (trail.length && trail[0].x < ox - TRAIL_LENGTH) trail.shift();
    }

    function update(dt) {
      time += dt;
      flapAnim = Math.max(0, flapAnim - dt);
      fx.update(dt);
      shake.update(dt);

      if (isOver) {
        // the bird keeps tumbling to the ground while the rest of the world freezes
        birdVy = Math.min(MAX_FALL_SPEED, birdVy + GRAVITY * dt);
        birdY = Math.min(groundY - BIRD_RADIUS, birdY + birdVy * dt);
        if (birdY < groundY - BIRD_RADIUS) spin += 0.012 * dt;
        trailFade = Math.max(0, trailFade - dt / 500);
        return;
      }

      scrollFar += 0.012 * dt;
      scrollNear += 0.035 * dt;

      if (!started) {
        birdY = height / 2 + Math.sin(time / 260) * 6; // idle bob until the first flap
        return;
      }

      scrollGround += PIPE_SPEED * dt;
      birdVy = Math.min(MAX_FALL_SPEED, birdVy + GRAVITY * dt);
      birdY += birdVy * dt;

      if (birdY - BIRD_RADIUS < 0) {
        birdY = BIRD_RADIUS;
        birdVy = 0;
      }

      if (birdY + BIRD_RADIUS >= groundY) {
        birdY = groundY - BIRD_RADIUS;
        die();
        return;
      }

      updateTrail(dt);

      for (let i = 0; i < pipes.length; i++) pipes[i].x -= PIPE_SPEED * dt;
      while (pipes.length && pipes[0].x + PIPE_WIDTH < 0) pipes.shift();

      const last = pipes[pipes.length - 1];
      if (last.x < width - PIPE_SPACING) spawnPipe(width);

      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        const rects = pipeRects(p);
        for (let r = 0; r < rects.length; r++) {
          const q = rects[r];
          if (q[3] > 0 && circleRectOverlap(birdX, birdY, BIRD_RADIUS, q[0], q[1], q[2], q[3])) {
            die();
            return;
          }
        }

        if (!p.passed && p.x + PIPE_WIDTH < birdX) {
          p.passed = true;
          score += 1;
          fx.float(birdX + 26, birdY - 28, '+1', colors.gold);
        }
      }
    }

    function drawPipePart(c, x, y, w, h, isCap) {
      const T = window.ArcadeTheme;
      if (h <= 0) return;
      const rx = Math.round(x);
      const ry = Math.round(y);
      c.fillStyle = colors.dark;
      c.fillRect(rx, ry, w, h);
      const ix = rx + 3;
      const iy = isCap ? ry + 3 : ry;
      const iw = w - 6;
      const ih = isCap ? h - 6 : h;
      c.fillStyle = colors.pipe;
      c.fillRect(ix, iy, iw, ih);
      c.fillStyle = T.shade(colors.pipe, 0.45);
      c.fillRect(ix, iy, 8, ih);
      c.fillStyle = T.shade(colors.pipe, -0.28);
      c.fillRect(ix + iw - 10, iy, 10, ih);
      if (isCap) {
        c.fillStyle = T.shade(colors.pipe, -0.28);
        c.fillRect(ix, iy + ih - 3, iw, 3);
      }
    }

    function drawPipes(c) {
      for (let i = 0; i < pipes.length; i++) {
        const p = pipes[i];
        const topBottom = p.gapCenter - PIPE_GAP / 2;
        const botTop = p.gapCenter + PIPE_GAP / 2;
        const bodyX = p.x + PIPE_BODY_INSET;
        const bodyW = PIPE_WIDTH - PIPE_BODY_INSET * 2;
        drawPipePart(c, bodyX, -4, bodyW, topBottom - PIPE_CAP_HEIGHT + 4, false);
        drawPipePart(c, p.x, topBottom - PIPE_CAP_HEIGHT, PIPE_WIDTH, PIPE_CAP_HEIGHT, true);
        drawPipePart(c, p.x, botTop, PIPE_WIDTH, PIPE_CAP_HEIGHT, true);
        drawPipePart(c, bodyX, botTop + PIPE_CAP_HEIGHT, bodyW, groundY - botTop - PIPE_CAP_HEIGHT, false);
      }
    }

    function drawGround(c) {
      const T = window.ArcadeTheme;
      c.fillStyle = T.shade(colors.border, -0.35);
      c.fillRect(0, groundY, width, GROUND_HEIGHT);
      c.fillStyle = colors.grass;
      c.fillRect(0, groundY, width, 10);
      c.fillStyle = T.shade(colors.grass, 0.3);
      c.fillRect(0, groundY, width, 3);
      c.fillStyle = T.shade(colors.grass, -0.3);
      const off = scrollGround % 32;
      for (let x = -32; x < width + 32; x += 32) {
        c.fillRect(Math.round(x - off), groundY + 3, 16, 7);
      }
      c.fillStyle = colors.border;
      for (let x = -32; x < width + 32; x += 32) {
        c.fillRect(Math.round(x - off + 8), groundY + 20, 10, 6);
      }
    }

    function drawCity(c) {
      const farOff = scrollFar % width;
      farCity.draw(c, -farOff, groundY - 150);
      farCity.draw(c, width - farOff, groundY - 150);
      const nearOff = scrollNear % width;
      nearCity.draw(c, -nearOff, groundY - 100);
      nearCity.draw(c, width - nearOff, groundY - 100);
    }

    function drawStars(c) {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = Math.sin(time / 420 + s.phase);
        c.fillStyle = tw > 0.2 ? colors.white : colors.text;
        c.globalAlpha = tw > -0.5 ? 0.85 : 0.35;
        c.fillRect(s.x, s.y, 2, 2);
      }
      c.globalAlpha = 1;
    }

    function drawTrail(c) {
      if (!trail.length || trailFade <= 0) return;
      const ox = birdX + TRAIL_OFFSET.x;
      const bands = trailColors.length;
      for (let b = 0; b < bands; b++) {
        c.fillStyle = trailColors[b];
        for (let i = 0; i < trail.length; i++) {
          const p = trail[i];
          const age = clamp((ox - p.x) / TRAIL_LENGTH, 0, 1);
          const alpha = (age < 0.65 ? 1 : 1 - (age - 0.65) / 0.35) * trailFade;
          if (alpha <= 0.02) continue;
          const shimmer = window.ArcadeTheme.reducedMotion ? 0 : Math.round(Math.sin(p.x * 0.06 + time * 0.012)) * 2;
          const y = Math.round((p.y + shimmer) / TRAIL_BAND) * TRAIL_BAND + (b - bands / 2) * TRAIL_BAND;
          c.globalAlpha = alpha;
          c.fillRect(Math.round(p.x), y, TRAIL_SLICE + 1, TRAIL_BAND);
        }
      }
      c.globalAlpha = 1;
    }

    function drawBird(c) {
      let frame = BIRD;
      if (isOver) frame = BIRD_TUCKED;
      else if (flapAnim > 0 && Math.floor(time / 80) % 2 === 0) frame = BIRD_TUCKED;

      // pixel art stays crisp only when it isn't rotated, so the bird only tumbles after crashing
      const angle = isOver ? clamp(spin, 0, 1.6) : 0;
      const flashing = isOver && Math.floor(time / 90) % 2 === 0;
      const lift = frame === BIRD_TUCKED && !isOver ? -SPRITE_SCALE : 0;

      c.save();
      c.translate(Math.round(birdX), Math.round(birdY));
      c.rotate(angle);
      window.ArcadePixel.draw(
        c, frame, flashing ? flashPalette : BIRD_PALETTE,
        -SPRITE_PIVOT.x * SPRITE_SCALE, -SPRITE_PIVOT.y * SPRITE_SCALE + lift, SPRITE_SCALE
      );
      c.restore();
    }

    function draw(context) {
      context.save();
      const o = shake.offset();
      context.translate(o.x, o.y);
      backdrop.draw(context);
      drawStars(context);
      drawCity(context);
      drawPipes(context);
      drawGround(context);
      drawTrail(context);
      drawBird(context);
      fx.draw(context);

      if (!started && !isOver && Math.floor(time / 500) % 2 === 0) {
        context.font = window.ArcadeTheme.font(10);
        context.fillStyle = colors.text;
        context.textAlign = 'center';
        context.fillText(window.ArcadeI18n.t('flappyLaunchHint'), width / 2, groundY - 24);
        context.textAlign = 'left';
      }
      context.restore();
    }

    return {
      id: 'flappy',
      title: 'Флэппи Берд',
      deathMs: 900,
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
      C: T.get('--flappy-accent'),
      K: BIRD_PALETTE.K,
      B: BIRD_PALETTE.B,
      E: BIRD_PALETTE.E,
      D: BIRD_PALETTE.D,
      H: BIRD_PALETTE.H
    });
  }

  window.ArcadeGames = window.ArcadeGames || new Map();
  window.ArcadeGames.set('flappy', {
    id: 'flappy',
    title: 'Флэппи Берд',
    icon,
    create: createFlappyGame
  });
})();
