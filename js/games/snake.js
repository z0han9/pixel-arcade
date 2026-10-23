(function () {
  const GRID = 40; // cell size is derived from the canvas size at init(), so GRID x GRID always fills it exactly
  const START_STEP_MS = 130;
  const STEP_DECREMENT_MS = 3;
  const MIN_STEP_MS = 60;
  const BODY_SHADES = 10;
  const APPLE_POP_MS = 180;

  const APPLE = [
    '....S...',
    '...SLL..',
    '.RRRRRR.',
    'RRHRRRRR',
    'RRHRRRRR',
    'RRRRRRRR',
    '.RRRRRR.',
    '..RR.RR.'
  ];

  const ICON = [
    '............',
    '.GGGGGGGGGG.',
    '.GGGGGGGGGG.',
    '.GG.........',
    '.GG.........',
    '.GGGGGGGGGG.',
    '.GGGGGGGGGG.',
    '..RR.....GG.',
    '..RR.....GG.',
    '.LLGGGGGGGG.',
    '.LKGGGGGGGG.',
    '............'
  ];

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function createSnakeGame() {
    let ctx, width, height, cell;
    let snake, dir, inputQueue, food, stepMs, acc, score, applesEaten, isOver;
    let time, foodAge, colors, bodyShades, backdrop, applePalette;
    const fx = window.ArcadeFx.createEmitter();
    const shake = window.ArcadeFx.createShake();

    function loadColors() {
      const T = window.ArcadeTheme;
      colors = {
        bg: T.get('--bg-game'),
        dot: T.alpha(T.get('--border-default'), 0.7),
        body: T.get('--snake-accent'),
        head: T.get('--snake-accent-2'),
        apple: T.get('--color-danger'),
        gold: T.get('--color-warning'),
        dark: T.get('--bg-app'),
        white: T.get('--text-primary')
      };
      bodyShades = [];
      for (let i = 0; i < BODY_SHADES; i++) {
        const base = T.mix(colors.body, colors.dark, (i / (BODY_SHADES - 1)) * 0.5);
        bodyShades.push({ base, light: T.shade(base, 0.28), dark: T.shade(base, -0.3) });
      }
      applePalette = {
        R: colors.apple,
        H: T.shade(colors.apple, 0.55),
        L: colors.head,
        S: T.shade(colors.body, -0.35)
      };
    }

    function buildBackdrop() {
      backdrop = window.ArcadeUtils.createLayer(ctx, width, height, (g) => {
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, width, height);
        g.fillStyle = colors.dot;
        for (let x = 0; x < GRID; x++) {
          for (let y = 0; y < GRID; y++) {
            g.fillRect(Math.round(x * cell + cell / 2 - 1), Math.round(y * cell + cell / 2 - 1), 2, 2);
          }
        }
      });
    }

    function freeCells() {
      const occupied = new Set(snake.map((s) => s.x + ',' + s.y));
      const free = [];
      for (let x = 0; x < GRID; x++) {
        for (let y = 0; y < GRID; y++) {
          if (!occupied.has(x + ',' + y)) free.push({ x, y });
        }
      }
      return free;
    }

    function spawnFood() {
      const free = freeCells();
      foodAge = 0;
      if (free.length === 0) return null;
      return free[Math.floor(Math.random() * free.length)];
    }

    function reset() {
      const start = Math.floor(GRID / 2);
      snake = [
        { x: start, y: start },
        { x: start - 1, y: start },
        { x: start - 2, y: start }
      ];
      dir = { x: 1, y: 0 };
      inputQueue = [];
      stepMs = START_STEP_MS;
      acc = 0;
      score = 0;
      applesEaten = 0;
      isOver = false;
      time = 0;
      fx.clear();
      food = spawnFood();
    }

    function init(context, w, h) {
      ctx = context;
      width = w;
      height = h;
      cell = w / GRID;
      loadColors();
      buildBackdrop();
      reset();
    }

    function lastQueuedDir() {
      return inputQueue.length ? inputQueue[inputQueue.length - 1] : dir;
    }

    function isOpposite(a, b) {
      return a.x === -b.x && a.y === -b.y;
    }

    function queueDir(nx, ny) {
      if (inputQueue.length >= 2) return;
      const last = lastQueuedDir();
      if (nx === last.x && ny === last.y) return;
      if (isOpposite({ x: nx, y: ny }, last)) return;
      inputQueue.push({ x: nx, y: ny });
    }

    function onInput(action) {
      if (isOver) return;
      if (action === 'UP') queueDir(0, -1);
      else if (action === 'DOWN') queueDir(0, 1);
      else if (action === 'LEFT') queueDir(-1, 0);
      else if (action === 'RIGHT') queueDir(1, 0);
    }

    function cellCenter(c) {
      return { x: c.x * cell + cell / 2, y: c.y * cell + cell / 2 };
    }

    function die() {
      isOver = true;
      const head = cellCenter(snake[0]);
      shake.trigger(7, 500);
      fx.burst(head.x, head.y, [colors.head, colors.body, colors.apple, colors.white], 26, { speed: 0.45, size: 5, life: 700 });
    }

    function step() {
      if (inputQueue.length) dir = inputQueue.shift();

      const nx = snake[0].x + dir.x;
      const ny = snake[0].y + dir.y;

      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
        die();
        return;
      }

      // The tail cell vacates this tick (unless we eat, and food never
      // spawns on an occupied cell, so it's always safe to exclude it).
      for (let i = 0; i < snake.length - 1; i++) {
        if (snake[i].x === nx && snake[i].y === ny) {
          die();
          return;
        }
      }

      snake.unshift({ x: nx, y: ny });

      if (food && nx === food.x && ny === food.y) {
        score += 1;
        applesEaten += 1;
        const at = cellCenter(food);
        fx.burst(at.x, at.y, [colors.apple, colors.head, colors.white], 12, { speed: 0.32, size: 4, life: 480 });
        fx.float(at.x, at.y - cell, '+1', colors.gold);
        stepMs = Math.max(MIN_STEP_MS, START_STEP_MS - applesEaten * STEP_DECREMENT_MS);
        food = spawnFood();
        if (!food) isOver = true; // board full, nowhere left to grow
      } else {
        snake.pop();
      }
    }

    function update(dt) {
      time += dt;
      foodAge += dt;
      fx.update(dt);
      shake.update(dt);
      if (isOver) return;

      acc += dt;
      while (acc >= stepMs) {
        acc -= stepMs;
        step();
        if (isOver) {
          acc = 0;
          break;
        }
      }
    }

    function drawSegment(c, s, shade, color) {
      const px = s.x * cell;
      const py = s.y * cell;
      const size = cell - 1;
      const bevel = Math.max(2, Math.round(cell / 8));
      c.fillStyle = color || shade.base;
      c.fillRect(px, py, size, size);
      if (color) return;
      c.fillStyle = shade.light;
      c.fillRect(px, py, size, bevel);
      c.fillRect(px, py, bevel, size);
      c.fillStyle = shade.dark;
      c.fillRect(px, py + size - bevel, size, bevel);
      c.fillRect(px + size - bevel, py, bevel, size);
    }

    function drawHead(c, flash) {
      const s = snake[0];
      const T = window.ArcadeTheme;
      const base = flash ? colors.apple : colors.head;
      drawSegment(c, s, { base, light: T.shade(base, 0.3), dark: T.shade(base, -0.28) });
      const cx = s.x * cell + (cell - 1) / 2;
      const cy = s.y * cell + (cell - 1) / 2;
      const eye = Math.max(2, Math.round(cell / 5));
      const fwd = cell * 0.2;
      const side = cell * 0.24;
      c.fillStyle = colors.dark;
      for (let sign = -1; sign <= 1; sign += 2) {
        const ex = cx + dir.x * fwd + -dir.y * side * sign;
        const ey = cy + dir.y * fwd + dir.x * side * sign;
        c.fillRect(Math.round(ex - eye / 2), Math.round(ey - eye / 2), eye, eye);
      }
    }

    function drawApple(c) {
      if (!food) return;
      const scale = Math.max(1, Math.floor(cell / 8));
      const sizePx = 8 * scale;
      const cx = food.x * cell + cell / 2;
      const cy = food.y * cell + cell / 2;
      const bob = isOver ? 0 : Math.round(Math.sin(time / 240));
      const popT = Math.min(1, foodAge / APPLE_POP_MS);
      const sc = popT < 1 ? Math.max(0.01, easeOutBack(popT)) : 1;
      c.save();
      c.translate(cx, cy + bob);
      c.scale(sc, sc);
      window.ArcadePixel.draw(c, APPLE, applePalette, -sizePx / 2, -sizePx / 2, scale);
      c.restore();
    }

    function draw(context) {
      context.save();
      const o = shake.offset();
      context.translate(o.x, o.y);
      backdrop.draw(context);

      drawApple(context);

      const len = snake.length;
      const flashOn = isOver && Math.floor(time / 90) % 2 === 0;
      for (let i = len - 1; i >= 1; i--) {
        const shade = bodyShades[Math.min(BODY_SHADES - 1, Math.floor((i / len) * BODY_SHADES))];
        drawSegment(context, snake[i], shade, flashOn ? colors.apple : null);
      }
      drawHead(context, flashOn);

      fx.draw(context);
      context.restore();
    }

    return {
      id: 'snake',
      title: 'Змейка',
      deathMs: 800,
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
      G: T.get('--snake-accent'),
      L: T.get('--snake-accent-2'),
      R: T.get('--color-danger'),
      K: T.get('--bg-app')
    });
  }

  window.ArcadeGames = window.ArcadeGames || new Map();
  window.ArcadeGames.set('snake', {
    id: 'snake',
    title: 'Змейка',
    icon,
    create: createSnakeGame
  });
})();
