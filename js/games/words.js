(function () {
  // "5 Letters": guess the hidden 5-letter word in 6 tries. Every solved word adds 1 to the streak
  // (the score) and a new word starts; a missed word ends the run.
  const WORD_LEN = 5;
  const MAX_TRIES = 6;

  const TILE = 56;
  const TILE_GAP = 8;
  const GRID_TOP = 44; // the strip above the grid holds the hint / toast messages

  const KEY_H = 56;
  const KEY_GAP = 4;
  const KEY_ROW_GAP = 6;
  const KB_SIDE = 8;
  const KB_BOTTOM = 14;
  const KEY_MAX_W = 58;
  const TAP_SLOP = 12; // a tap this close to a key still counts, so the gaps between keys are not dead zones

  const reduced = window.ArcadeTheme.reducedMotion;
  const FLIP_MS = reduced ? 0 : 260;
  const FLIP_STAGGER = reduced ? 0 : 150;
  const SHAKE_MS = reduced ? 0 : 380;
  const POP_MS = 110;
  const PRESS_MS = 110;
  const WIN_MS = 1500;
  const TOAST_MS = 1300;

  const LAYOUTS = {
    ru: ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'],
    en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
  };

  // Physical key positions (KeyboardEvent.code) in the same order as LAYOUTS, so Russian words can be
  // typed while the system keyboard is switched to English and the other way round.
  const CODE_ROWS = [
    ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'],
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
    ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period']
  ];

  const MARK_RANK = { a: 1, p: 2, c: 3 }; // absent < present < correct

  const ENTER_ICON = [
    '........X',
    '.......XX',
    '......XX.',
    'X....XX..',
    'XX..XX...',
    '.XXXX....',
    '..XX.....'
  ];

  const BACK_ICON = [
    '...X.....',
    '..XX.....',
    '.XXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXXX',
    '..XX.....',
    '...X.....'
  ];

  const ICON = [
    'DDD.YYY.DDD',
    'DDD.YYY.DDD',
    'DDD.YYY.DDD',
    '...........',
    'YYY.DDD.GGG',
    'YYY.DDD.GGG',
    'YYY.DDD.GGG',
    '...........',
    'GGG.GGG.GGG',
    'GGG.GGG.GGG',
    'GGG.GGG.GGG'
  ];

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function splitWords(packed) {
    const out = [];
    for (let i = 0; i + WORD_LEN <= packed.length; i += WORD_LEN) out.push(packed.slice(i, i + WORD_LEN));
    return out;
  }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // 'c' = right letter, right place; 'p' = letter is in the word elsewhere; 'a' = not in the word.
  // Two passes so a repeated letter is only marked as many times as the answer really contains it.
  function evaluate(guess, target) {
    const marks = new Array(WORD_LEN).fill('a');
    const left = {};
    for (let i = 0; i < WORD_LEN; i++) {
      if (guess[i] === target[i]) marks[i] = 'c';
      else left[target[i]] = (left[target[i]] || 0) + 1;
    }
    for (let i = 0; i < WORD_LEN; i++) {
      if (marks[i] !== 'c' && left[guess[i]] > 0) {
        marks[i] = 'p';
        left[guess[i]]--;
      }
    }
    return marks;
  }

  function createWordsGame() {
    let ctx, width, height;
    let lang, answers, valid, queue, alphabet, letterByCode, strings;
    let target, rows, current, phase, phaseT, keyMarks, score, isOver;
    let toast, shakeT, pop, pressed;
    let colors, backdrop, keys, kbTop, gridX;
    const fx = window.ArcadeFx.createEmitter();

    function loadLanguage() {
      const data = window.ArcadeWordData;
      lang = data[window.ArcadeI18n.getLang()] ? window.ArcadeI18n.getLang() : 'ru';
      answers = splitWords(data[lang].answers);
      valid = new Set(answers);
      splitWords(data[lang].extra).forEach((w) => valid.add(w));

      alphabet = new Set(LAYOUTS[lang].join(''));
      letterByCode = {};
      LAYOUTS[lang].forEach((letters, r) => {
        for (let i = 0; i < letters.length; i++) letterByCode[CODE_ROWS[r][i]] = letters[i];
      });
      if (lang === 'ru') letterByCode.Backquote = 'е'; // the "ё" key

      const t = window.ArcadeI18n.t;
      strings = {
        hint: t('wordsHint'),
        tooShort: t('wordsTooShort'),
        notInList: t('wordsNotInList'),
        answer: t('wordsAnswer'),
        praise: t('wordsPraise').split('|')
      };
    }

    function loadColors() {
      const T = window.ArcadeTheme;
      const border = T.get('--border-default');
      const dark = T.get('--bg-app');
      const white = T.get('--text-primary');
      const dim = T.get('--text-secondary');
      const panel = T.get('--bg-panel');
      const absent = T.mix(dim, dark, 0.66); // neutral grey, clearly different from the purple empty cells
      colors = {
        bg: T.get('--bg-game'),
        panel,
        border,
        cell: T.alpha(border, 0.4),
        accent: T.get('--words-accent'),
        dark,
        white,
        dim,
        danger: T.get('--color-danger'),
        tile: {
          c: { bg: T.get('--color-success'), fg: dark },
          p: { bg: T.get('--color-warning'), fg: dark },
          a: { bg: absent, fg: dim }
        },
        key: {
          c: { bg: T.get('--color-success'), fg: dark },
          p: { bg: T.get('--color-warning'), fg: dark },
          a: { bg: T.mix(panel, dark, 0.55), fg: T.mix(dim, dark, 0.45) }
        },
        keyBg: T.mix(border, white, 0.16)
      };
    }

    function tilePos(r, c) {
      return { x: gridX + c * (TILE + TILE_GAP), y: GRID_TOP + r * (TILE + TILE_GAP) };
    }

    function buildKeys() {
      const layout = LAYOUTS[lang];
      const maxLen = Math.max.apply(null, layout.map((row) => row.length));
      const keyW = Math.min(KEY_MAX_W, (width - KB_SIDE * 2 - (maxLen - 1) * KEY_GAP) / maxLen);
      const fullW = maxLen * keyW + (maxLen - 1) * KEY_GAP;
      kbTop = height - KB_BOTTOM - (layout.length * KEY_H + (layout.length - 1) * KEY_ROW_GAP);
      keys = [];
      layout.forEach((letters, r) => {
        const y = kbTop + r * (KEY_H + KEY_ROW_GAP);
        const lettersW = letters.length * keyW + (letters.length - 1) * KEY_GAP;
        let x = (width - lettersW) / 2;
        if (r === layout.length - 1) {
          // Enter and Backspace fill what is left of the bottom row
          const side = (fullW - lettersW) / 2 - KEY_GAP;
          const left = (width - fullW) / 2;
          keys.push({ id: 'enter', x: left, y, w: side, h: KEY_H });
          keys.push({ id: 'back', x: left + fullW - side, y, w: side, h: KEY_H });
        }
        for (let i = 0; i < letters.length; i++) {
          keys.push({ id: letters[i], x, y, w: keyW, h: KEY_H });
          x += keyW + KEY_GAP;
        }
      });
    }

    function buildBackdrop() {
      backdrop = window.ArcadeUtils.createLayer(ctx, width, height, (g) => {
        g.fillStyle = colors.bg;
        g.fillRect(0, 0, width, height);
        for (let r = 0; r < MAX_TRIES; r++) {
          for (let c = 0; c < WORD_LEN; c++) {
            const p = tilePos(r, c);
            g.fillStyle = colors.border;
            g.fillRect(p.x, p.y, TILE, TILE);
            g.fillStyle = colors.bg;
            g.fillRect(p.x + 2, p.y + 2, TILE - 4, TILE - 4);
            g.fillStyle = colors.cell;
            g.fillRect(p.x + 2, p.y + 2, TILE - 4, TILE - 4);
          }
        }
      });
    }

    function startRound() {
      if (!queue.length) queue = shuffled(answers);
      target = queue.pop();
      rows = [];
      current = '';
      keyMarks = {};
      phase = 'input';
      phaseT = 0;
      shakeT = 0;
      pop = null;
    }

    function reset() {
      score = 0;
      isOver = false;
      queue = [];
      toast = null;
      pressed = null;
      fx.clear();
      startRound();
    }

    function init(context, w, h) {
      ctx = context;
      width = w;
      height = h;
      gridX = Math.round((width - (WORD_LEN * TILE + (WORD_LEN - 1) * TILE_GAP)) / 2);
      loadLanguage();
      loadColors();
      buildKeys();
      buildBackdrop();
      reset();
    }

    function showToast(text, tone, ttl) {
      toast = { text, tone, ttl };
    }

    function reject(text) {
      showToast(text, 'info', TOAST_MS);
      shakeT = SHAKE_MS;
    }

    function submit() {
      if (current.length < WORD_LEN) return reject(strings.tooShort);
      if (!valid.has(current)) return reject(strings.notInList);
      rows.push({ word: current, marks: evaluate(current, target) });
      current = '';
      toast = null;
      phase = 'reveal';
      phaseT = 0;
    }

    function finishReveal() {
      const row = rows[rows.length - 1];
      for (let i = 0; i < WORD_LEN; i++) {
        const letter = row.word[i];
        if ((MARK_RANK[row.marks[i]] || 0) > (MARK_RANK[keyMarks[letter]] || 0)) keyMarks[letter] = row.marks[i];
      }

      if (row.word === target) {
        score += 1;
        phase = 'won';
        phaseT = 0;
        showToast(strings.praise[rows.length - 1] || strings.praise[0], 'good', WIN_MS);
        const r = rows.length - 1;
        for (let c = 0; c < WORD_LEN; c++) {
          const p = tilePos(r, c);
          fx.burst(p.x + TILE / 2, p.y + TILE / 2, [colors.tile.c.bg, colors.tile.p.bg, colors.white], 8, {
            speed: 0.36, size: 6, life: 600, gravity: 0.0005
          });
        }
        fx.float(gridX + WORD_LEN * (TILE + TILE_GAP) + 22, tilePos(r, 0).y + TILE / 2, '+1', colors.tile.c.bg);
      } else if (rows.length >= MAX_TRIES) {
        phase = 'lost';
        isOver = true;
        showToast(strings.answer + target.toUpperCase(), 'bad', Infinity);
      } else {
        phase = 'input';
      }
    }

    // id is a letter, 'enter' or 'back' - the same for the on-screen keys and the real keyboard
    function press(id) {
      if (isOver || phase !== 'input') return;
      pressed = { id, t: PRESS_MS };
      if (id === 'enter') {
        submit();
      } else if (id === 'back') {
        current = current.slice(0, -1);
      } else if (current.length < WORD_LEN) {
        current += id;
        pop = { col: current.length - 1, t: POP_MS };
      }
    }

    function letterFor(key, code) {
      let k = (key || '').toLowerCase();
      if (k === 'ё') k = 'е';
      if (k.length === 1 && alphabet.has(k)) return k;
      return letterByCode[code] || null;
    }

    // Returns true when the key belongs to the game, so the hub can stop the browser's own handling of it.
    function onKey(key, code) {
      if (key === 'Enter') {
        press('enter');
        return true;
      }
      if (key === 'Backspace') {
        press('back');
        return true;
      }
      if (key === ' ') return true;
      const letter = letterFor(key, code);
      if (!letter) return false;
      press(letter);
      return true;
    }

    function keyAt(x, y) {
      let best = null;
      let bestDist = Infinity;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const dx = Math.max(k.x - x, 0, x - (k.x + k.w));
        const dy = Math.max(k.y - y, 0, y - (k.y + k.h));
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          best = k;
        }
      }
      return bestDist <= TAP_SLOP * TAP_SLOP ? best : null;
    }

    function onTap(x, y) {
      const key = keyAt(x, y);
      if (key) press(key.id);
    }

    function update(dt) {
      fx.update(dt);
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
      if (pop && (pop.t -= dt) <= 0) pop = null;
      if (pressed && (pressed.t -= dt) <= 0) pressed = null;
      if (toast && (toast.ttl -= dt) <= 0) toast = null;

      if (phase === 'reveal') {
        phaseT += dt;
        if (phaseT >= FLIP_STAGGER * (WORD_LEN - 1) + FLIP_MS) finishReveal();
      } else if (phase === 'won') {
        phaseT += dt;
        if (phaseT >= WIN_MS) startRound();
      }
    }

    function drawTile(c, x, y, letter, kind, sx, sy) {
      const half = TILE / 2;
      let fg;
      c.save();
      c.translate(Math.round(x + half), Math.round(y + half));
      if (sx !== 1 || sy !== 1) c.scale(sx, sy);
      if (kind === 'typed') {
        fg = colors.white;
        c.fillStyle = colors.accent;
        c.fillRect(-half, -half, TILE, TILE);
        c.fillStyle = colors.panel;
        c.fillRect(-half + 3, -half + 3, TILE - 6, TILE - 6);
      } else {
        const T = window.ArcadeTheme;
        const style = colors.tile[kind];
        fg = style.fg;
        c.fillStyle = style.bg;
        c.fillRect(-half, -half, TILE, TILE);
        c.fillStyle = T.shade(style.bg, 0.3);
        c.fillRect(-half, -half, TILE, 3);
        c.fillRect(-half, -half, 3, TILE);
        c.fillStyle = T.shade(style.bg, -0.3);
        c.fillRect(-half, half - 3, TILE, 3);
        c.fillRect(half - 3, -half, 3, TILE);
      }
      c.font = window.ArcadeTheme.font(26);
      c.fillStyle = fg;
      c.fillText(letter.toUpperCase(), 0, 2);
      c.restore();
    }

    function drawRows(c) {
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const last = r === rows.length - 1;
        for (let col = 0; col < WORD_LEN; col++) {
          const p = tilePos(r, col);
          let kind = row.marks[col];
          let sy = 1;
          let lift = 0;
          if (last && phase === 'reveal') {
            // flip: the plain face squashes to a line, then the coloured face opens up
            const k = FLIP_MS ? clamp01((phaseT - col * FLIP_STAGGER) / FLIP_MS) : 1;
            if (k < 0.5) {
              kind = 'typed';
              sy = 1 - k * 2;
            } else {
              sy = k * 2 - 1;
            }
          } else if (last && phase === 'won' && !reduced) {
            const t = phaseT - col * 80;
            if (t > 0 && t < 420) lift = -16 * Math.sin((Math.PI * t) / 420);
          }
          drawTile(c, p.x, p.y + lift, row.word[col], kind, 1, Math.max(0.04, sy));
        }
      }

      if (rows.length < MAX_TRIES && current.length) {
        const k = shakeT / (SHAKE_MS || 1);
        const dx = shakeT > 0 ? Math.round(Math.sin((1 - k) * Math.PI * 5) * 8 * k) : 0;
        for (let col = 0; col < current.length; col++) {
          const p = tilePos(rows.length, col);
          const s = pop && pop.col === col ? 1 + 0.14 * Math.sin(Math.PI * (1 - pop.t / POP_MS)) : 1;
          drawTile(c, p.x + dx, p.y, current[col], 'typed', s, s);
        }
      }
    }

    function drawKeyboard(c) {
      const T = window.ArcadeTheme;
      const fontPx = lang === 'ru' ? 18 : 20;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const mark = keyMarks[k.id];
        let bg = colors.keyBg;
        let fg = colors.white;
        if (k.id === 'enter') {
          bg = colors.accent;
          fg = colors.dark;
        } else if (mark) {
          bg = colors.key[mark].bg;
          fg = colors.key[mark].fg;
        }
        const down = pressed && pressed.id === k.id;
        const x = Math.round(k.x);
        const w = Math.round(k.x + k.w) - x;
        const y = Math.round(k.y) + (down ? 3 : 0);
        const h = k.h - (down ? 3 : 0);
        c.fillStyle = T.shade(bg, -0.4);
        c.fillRect(x, y, w, h);
        c.fillStyle = down ? T.shade(bg, 0.18) : bg;
        c.fillRect(x, y, w, h - (down ? 1 : 4));

        const cx = x + w / 2;
        const cy = y + (h - (down ? 1 : 4)) / 2;
        if (k.id === 'enter' || k.id === 'back') {
          const art = k.id === 'enter' ? ENTER_ICON : BACK_ICON;
          const scale = 3;
          window.ArcadePixel.draw(c, art, { X: fg },
            Math.round(cx - (art[0].length * scale) / 2), Math.round(cy - (art.length * scale) / 2), scale);
        } else {
          c.font = T.font(fontPx);
          c.fillStyle = fg;
          c.fillText(k.id.toUpperCase(), Math.round(cx), Math.round(cy) + 2);
        }
      }
    }

    function drawStatus(c) {
      const T = window.ArcadeTheme;
      const cy = GRID_TOP / 2;
      if (!toast) {
        c.font = T.font(10);
        c.fillStyle = colors.dim;
        c.fillText(strings.hint, width / 2, cy + 1);
        return;
      }
      c.font = T.font(12);
      const w = Math.ceil(c.measureText(toast.text).width) + 28;
      const h = 30;
      const x = Math.round((width - w) / 2);
      const y = Math.round(cy - h / 2);
      const bg = toast.tone === 'good' ? colors.tile.c.bg : toast.tone === 'bad' ? colors.danger : colors.white;
      c.fillStyle = T.get('--shadow-hard');
      c.fillRect(x + 3, y + 3, w, h);
      c.fillStyle = bg;
      c.fillRect(x, y, w, h);
      c.fillStyle = colors.dark;
      c.fillText(toast.text, width / 2, cy + 2);
    }

    function draw(context) {
      backdrop.draw(context);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      drawRows(context);
      drawKeyboard(context);
      drawStatus(context);
      fx.draw(context);
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
    }

    return {
      id: 'words',
      title: '5 Letters',
      deathMs: 1600, // leave the finished board on screen for a moment before the Game Over box
      get score() { return score; },
      get isOver() { return isOver; },
      get overNote() { return phase === 'lost' ? strings.answer + target.toUpperCase() : ''; },
      init,
      update,
      draw,
      onInput() {},
      onKey,
      onTap,
      reset
    };
  }

  function icon() {
    const T = window.ArcadeTheme;
    return window.ArcadePixel.toSvg(ICON, {
      G: T.get('--color-success'),
      Y: T.get('--color-warning'),
      D: T.mix(T.get('--border-default'), T.get('--text-primary'), 0.22)
    });
  }

  window.ArcadeGames = window.ArcadeGames || new Map();
  window.ArcadeGames.set('words', {
    id: 'words',
    title: '5 Letters',
    countdown: false, // turn-based: no get-ready countdown on start/resume
    textInput: true, // the hub sends raw key presses (onKey) and taps (onTap) instead of arrow actions
    icon,
    create: createWordsGame
  });
})();
