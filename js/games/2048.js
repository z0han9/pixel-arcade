(function () {
  const SIZE = 4;
  const BOARD_MARGIN = 30;
  const CELL_GAP = 12;
  const SLIDE_MS = 110;
  const POP_MS = 150;

  const ICON = [
    'AAAAA.BBBBB',
    'AAAAA.BBBBB',
    'AAAAA.BBBBB',
    'AAAAA.BBBBB',
    'AAAAA.BBBBB',
    '...........',
    'CCCCC.DDDDD',
    'CCCCC.DDDDD',
    'CCCCC.DDDDD',
    'CCCCC.DDDDD',
    'CCCCC.DDDDD'
  ];

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Slides one line towards index 0 and merges equal neighbours once.
  // Also reports where every source tile ends up, for the slide animation.
  function slideLine(line) {
    const items = [];
    for (let i = 0; i < SIZE; i++) if (line[i]) items.push({ value: line[i], from: i });
    const out = new Array(SIZE).fill(0);
    const moves = [];
    const merges = [];
    let gained = 0;
    let j = 0;
    for (let k = 0; k < items.length; k++) {
      const a = items[k];
      const b = items[k + 1];
      if (b && b.value === a.value) {
        const nv = a.value * 2;
        out[j] = nv;
        gained += nv;
        moves.push({ from: a.from, to: j, value: a.value }, { from: b.from, to: j, value: b.value });
        merges.push({ to: j, value: nv });
        k++;
      } else {
        out[j] = a.value;
        moves.push({ from: a.from, to: j, value: a.value });
      }
      j++;
    }
    return { out, gained, moves, merges };
  }

  function createGame2048() {
    let ctx, width, height;
    let board, score, isOver, anim, time;
    let colors, backdrop, tileStyles;
    const fx = window.ArcadeFx.createEmitter();

    function loadColors() {
      const T = window.ArcadeTheme;
      const accent = T.get('--2048-accent');
      const border = T.get('--border-default');
      const dark = T.get('--bg-app');
      const white = T.get('--text-primary');
      colors = {
        bg: T.get('--bg-game'),
        panel: T.get('--bg-panel'),
        border,
        cell: T.alpha(border, 0.5),
        accent,
        dark,
        white,
        gold: T.get('--color-warning'),
        danger: T.get('--color-danger')
      };
      // 2..64: lavender ramp built from the game accent; 128+: peach -> gold "reward" ramp
      const lav = [
        T.mix(accent, white, 0.62), T.mix(accent, white, 0.4), T.mix(accent, white, 0.18),
        accent, T.mix(accent, border, 0.32), T.mix(accent, border, 0.58)
      ];
      const warm = [
        T.get('--2048-accent-2'), T.get('--bricks-accent-2'), T.get('--bricks-accent'),
        T.get('--color-warning'), white
      ];
      tileStyles = {};
      lav.forEach((bg, i) => {
        tileStyles[Math.pow(2, i + 1)] = { bg, fg: i <= 3 ? dark : white };
      });
      warm.forEach((bg, i) => {
        tileStyles[Math.pow(2, i + 7)] = { bg, fg: dark };
      });
    }

    function styleFor(value) {
      return tileStyles[value] || { bg: colors.danger, fg: colors.dark };
    }

    function boardGeometry() {
      const boardSize = Math.min(width, height) - BOARD_MARGIN * 2;
      const cellSize = (boardSize - (SIZE - 1) * CELL_GAP) / SIZE;
      return { boardSize, cellSize, x0: (width - boardSize) / 2, y0: (height - boardSize) / 2 };
    }

    function cellPos(r, c) {
      const g = boardGeometry();
      return { x: g.x0 + c * (g.cellSize + CELL_GAP), y: g.y0 + r * (g.cellSize + CELL_GAP), size: g.cellSize };
    }

    function buildBackdrop() {
      const g0 = boardGeometry();
      backdrop = window.ArcadeUtils.createLayer(ctx, width, height, (g) => {
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, width, height);
        const pad = 12;
        g.fillStyle = colors.border;
        g.fillRect(g0.x0 - pad - 4, g0.y0 - pad - 4, g0.boardSize + (pad + 4) * 2, g0.boardSize + (pad + 4) * 2);
        g.fillStyle = colors.panel;
        g.fillRect(g0.x0 - pad, g0.y0 - pad, g0.boardSize + pad * 2, g0.boardSize + pad * 2);
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const p = cellPos(r, c);
            g.fillStyle = colors.cell;
            g.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.size), Math.round(p.size));
          }
        }
      });
    }

    function emptyCells() {
      const cells = [];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (board[r][c] === 0) cells.push({ r, c });
        }
      }
      return cells;
    }

    function spawnTile() {
      const free = emptyCells();
      if (free.length === 0) return null;
      const cell = free[Math.floor(Math.random() * free.length)];
      board[cell.r][cell.c] = Math.random() < 0.9 ? 2 : 4;
      return cell;
    }

    function hasAnyMove() {
      if (emptyCells().length > 0) return true;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const v = board[r][c];
          if (c + 1 < SIZE && board[r][c + 1] === v) return true;
          if (r + 1 < SIZE && board[r + 1][c] === v) return true;
        }
      }
      return false;
    }

    function reset() {
      board = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
      score = 0;
      isOver = false;
      time = 0;
      fx.clear();
      const a = spawnTile();
      const b = spawnTile();
      anim = { t: SLIDE_MS, moves: [], merges: [], spawns: [a, b].filter(Boolean), burst: true };
    }

    function init(context, w, h) {
      ctx = context;
      width = w;
      height = h;
      loadColors();
      buildBackdrop();
      reset();
    }

    // line index L + position i along the movement direction -> board cell
    function coord(direction, L, i) {
      if (direction === 'LEFT') return { r: L, c: i };
      if (direction === 'RIGHT') return { r: L, c: SIZE - 1 - i };
      if (direction === 'UP') return { r: i, c: L };
      return { r: SIZE - 1 - i, c: L };
    }

    function move(direction) {
      const before = JSON.stringify(board);
      const moves = [];
      const merges = [];
      let gainedTotal = 0;

      for (let L = 0; L < SIZE; L++) {
        const line = [];
        for (let i = 0; i < SIZE; i++) {
          const p = coord(direction, L, i);
          line.push(board[p.r][p.c]);
        }
        const res = slideLine(line);
        gainedTotal += res.gained;
        for (let i = 0; i < SIZE; i++) {
          const p = coord(direction, L, i);
          board[p.r][p.c] = res.out[i];
        }
        res.moves.forEach((m) => {
          const f = coord(direction, L, m.from);
          const t = coord(direction, L, m.to);
          moves.push({ fr: f.r, fc: f.c, tr: t.r, tc: t.c, value: m.value });
        });
        res.merges.forEach((m) => {
          const t = coord(direction, L, m.to);
          merges.push({ r: t.r, c: t.c, value: m.value });
        });
      }

      if (JSON.stringify(board) === before) return;

      score += gainedTotal;
      const spawned = spawnTile();
      anim = { t: 0, moves, merges, spawns: spawned ? [spawned] : [], burst: false };
      if (!hasAnyMove()) isOver = true;
    }

    function onInput(action) {
      if (isOver) return;
      if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
        move(action);
      }
    }

    function popMerges() {
      anim.burst = true;
      anim.merges.forEach((m) => {
        const p = cellPos(m.r, m.c);
        const style = styleFor(m.value);
        fx.burst(p.x + p.size / 2, p.y + p.size / 2, [style.bg, window.ArcadeTheme.shade(style.bg, 0.4), colors.white], 10, {
          speed: 0.34, size: 6, life: 520, gravity: 0.0004
        });
        if (m.value >= 16) fx.float(p.x + p.size / 2, p.y + p.size * 0.2, '+' + m.value, colors.gold);
      });
    }

    function update(dt) {
      time += dt;
      fx.update(dt);
      if (!anim) return;
      anim.t += dt;
      if (!anim.burst && anim.t >= SLIDE_MS) popMerges();
      if (anim.t >= SLIDE_MS + POP_MS) anim = null;
    }

    function drawTile(c, x, y, size, value, scale) {
      const T = window.ArcadeTheme;
      const style = styleFor(value);
      const s = size * scale;
      const px = Math.round(x + (size - s) / 2);
      const py = Math.round(y + (size - s) / 2);
      const ps = Math.round(s);
      const bevel = Math.max(3, Math.round(ps / 28));
      c.fillStyle = style.bg;
      c.fillRect(px, py, ps, ps);
      c.fillStyle = T.shade(style.bg, 0.35);
      c.fillRect(px, py, ps, bevel);
      c.fillRect(px, py, bevel, ps);
      c.fillStyle = T.shade(style.bg, -0.3);
      c.fillRect(px, py + ps - bevel, ps, bevel);
      c.fillRect(px + ps - bevel, py, bevel, ps);

      const digits = String(value).length;
      const fontPx = Math.round(ps * [0, 0.34, 0.29, 0.23, 0.19, 0.16][Math.min(digits, 5)]);
      c.font = T.font(fontPx);
      c.fillStyle = style.fg;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(value), px + ps / 2, py + ps / 2 + 2);
    }

    function spawnScale(r, c) {
      if (!anim || anim.t < SLIDE_MS) return null;
      for (let i = 0; i < anim.spawns.length; i++) {
        if (anim.spawns[i].r === r && anim.spawns[i].c === c) {
          return Math.max(0.01, easeOutBack(clamp01((anim.t - SLIDE_MS) / POP_MS)));
        }
      }
      return null;
    }

    function mergeScale(r, c) {
      if (!anim || anim.t < SLIDE_MS) return null;
      for (let i = 0; i < anim.merges.length; i++) {
        if (anim.merges[i].r === r && anim.merges[i].c === c) {
          const p = clamp01((anim.t - SLIDE_MS) / POP_MS);
          return 1 + 0.2 * Math.sin(p * Math.PI);
        }
      }
      return null;
    }

    function draw(context) {
      backdrop.draw(context);

      if (anim && anim.t < SLIDE_MS) {
        // sliding phase: every tile glides from its old cell to its new one
        const k = easeOut(clamp01(anim.t / SLIDE_MS));
        anim.moves.forEach((m) => {
          const a = cellPos(m.fr, m.fc);
          const b = cellPos(m.tr, m.tc);
          drawTile(context, a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.size, m.value, 1);
        });
      } else {
        for (let r = 0; r < SIZE; r++) {
          for (let c = 0; c < SIZE; c++) {
            const value = board[r][c];
            if (!value) continue;
            const p = cellPos(r, c);
            const scale = spawnScale(r, c) || mergeScale(r, c) || 1;
            drawTile(context, p.x, p.y, p.size, value, scale);
          }
        }
      }

      fx.draw(context);
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
    }

    return {
      id: '2048',
      title: '2048',
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
    const accent = T.get('--2048-accent');
    return window.ArcadePixel.toSvg(ICON, {
      A: T.mix(accent, T.get('--text-primary'), 0.55),
      B: accent,
      C: T.get('--2048-accent-2'),
      D: T.get('--color-warning')
    });
  }

  window.ArcadeGames = window.ArcadeGames || new Map();
  window.ArcadeGames.set('2048', {
    id: '2048',
    title: '2048',
    countdown: false, // turn-based: no get-ready countdown on start/resume
    icon,
    create: createGame2048
  });
})();
