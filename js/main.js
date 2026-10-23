(function () {
  const appEl = document.getElementById('app');
  const menuBg = document.getElementById('menuBg');
  const canvas = document.getElementById('gameCanvas');
  const canvasWrap = document.getElementById('canvasWrap');
  const menuScreen = document.getElementById('menuScreen');
  const settingsScreen = document.getElementById('settingsScreen');
  const settingsBtn = document.getElementById('settingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const langButtons = Array.from(document.querySelectorAll('.lang-btn'));
  const gameListEl = document.getElementById('gameList');
  const scoreDisplay = document.getElementById('scoreDisplay');
  const scoreValueEl = document.getElementById('scoreValue');
  const backBtn = document.getElementById('backBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumberEl = document.getElementById('countdownNumber');
  const gameOverOverlay = document.getElementById('gameOverOverlay');
  const finalScoreEl = document.getElementById('finalScore');
  const resumeBtn = document.getElementById('resumeBtn');
  const pauseMenuBtn = document.getElementById('pauseMenuBtn');
  const retryBtn = document.getElementById('retryBtn');
  const menuBtn = document.getElementById('menuBtn');

  const ctx = canvas.getContext('2d');

  const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', PAUSED: 'PAUSED', COUNTDOWN: 'COUNTDOWN', GAME_OVER: 'GAME_OVER' };
  let state = STATE.MENU;
  let currentGameDef = null;
  let currentGame = null;

  const LOGICAL_SIZE = 640;
  const FIXED_STEP = 1000 / 60; // 16.67ms
  const MAX_STEPS_PER_FRAME = 5; // avoids spiral of death after a big stall
  const COUNTDOWN_MS = 3000;

  let lastTime = 0;
  let accumulator = 0;
  let countdownRemaining = 0;
  let shownCountdown = null;
  let shownScore = null;
  let overTimer = null; // ms left of the game's death animation before the Game Over overlay
  let settingsOpen = false;

  function resizeCanvasForDPI() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = LOGICAL_SIZE * dpr;
    canvas.height = LOGICAL_SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function renderMenu() {
    gameListEl.innerHTML = '';
    Array.from(window.ArcadeGames ? window.ArcadeGames.values() : []).forEach((def, index) => {
      const hi = window.ArcadeStorage.getHighScore(def.id);
      const card = document.createElement('button');
      card.className = 'game-card';
      card.dataset.game = def.id;
      card.style.animationDelay = index * 60 + 'ms';
      card.innerHTML =
        '<span class="game-card-icon">' + (def.icon ? def.icon() : '') + '</span>' +
        '<span class="game-card-text">' +
          '<span class="game-card-title">' + window.ArcadeI18n.t('game.' + def.id) + '</span>' +
          '<span class="game-card-hi">' + window.ArcadeI18n.t('highScoreLabel') + ': <b>' + hi + '</b></span>' +
        '</span>';
      card.addEventListener('click', () => startGame(def.id));
      gameListEl.appendChild(card);
    });
  }

  function refreshMenuVisibility() {
    menuScreen.hidden = state !== STATE.MENU || settingsOpen;
    settingsScreen.hidden = state !== STATE.MENU || !settingsOpen;
    settingsBtn.hidden = state !== STATE.MENU || settingsOpen;
  }

  // The arcade-hall picture only sits behind the menu; games draw on their own backdrop.
  function syncMenuBackground() {
    menuBg.hidden = state !== STATE.MENU;
  }

  function setCountdownNumber(n) {
    if (n === shownCountdown) return;
    shownCountdown = n;
    countdownNumberEl.textContent = String(n);
    countdownNumberEl.classList.remove('pop');
    void countdownNumberEl.offsetWidth; // restart the CSS animation
    countdownNumberEl.classList.add('pop');
  }

  function setState(next) {
    state = next;
    if (state === STATE.COUNTDOWN) {
      countdownRemaining = COUNTDOWN_MS;
      shownCountdown = null;
      setCountdownNumber(COUNTDOWN_MS / 1000);
    }
    refreshMenuVisibility();
    syncMenuBackground();
    canvasWrap.hidden = state === STATE.MENU;
    pauseOverlay.hidden = state !== STATE.PAUSED;
    countdownOverlay.hidden = state !== STATE.COUNTDOWN;
    gameOverOverlay.hidden = state !== STATE.GAME_OVER;
    scoreDisplay.hidden = state === STATE.MENU;
    backBtn.hidden = state === STATE.MENU;
    pauseBtn.hidden = state === STATE.MENU;
    pauseBtn.disabled = state === STATE.GAME_OVER;
    pauseBtn.textContent = state === STATE.PAUSED ? window.ArcadeI18n.t('resume') : window.ArcadeI18n.t('pause');
  }

  function startGame(id) {
    const def = window.ArcadeGames.get(id);
    if (!def) return;
    currentGameDef = def;
    appEl.dataset.game = id;
    resizeCanvasForDPI();
    currentGame = def.create();
    currentGame.init(ctx, LOGICAL_SIZE, LOGICAL_SIZE);
    accumulator = 0;
    overTimer = null;
    lastTime = performance.now();
    updateScoreDisplay(0);
    beginPlay();
  }

  function beginPlay() {
    const wantsCountdown = !currentGameDef || currentGameDef.countdown !== false;
    setState(wantsCountdown ? STATE.COUNTDOWN : STATE.PLAYING);
  }

  function goToMenu() {
    currentGame = null;
    currentGameDef = null;
    overTimer = null;
    delete appEl.dataset.game;
    renderMenu();
    updateScoreDisplay(0);
    setState(STATE.MENU);
  }

  function pauseGame() {
    if (state !== STATE.PLAYING && state !== STATE.COUNTDOWN) return;
    if (overTimer !== null) return; // let the death animation finish
    setState(STATE.PAUSED);
  }

  function resumeGame() {
    if (state !== STATE.PAUSED) return;
    lastTime = performance.now();
    accumulator = 0;
    beginPlay();
  }

  function retryGame() {
    if (!currentGameDef) return;
    startGame(currentGameDef.id);
  }

  function handleGameOver() {
    const isNewHi = window.ArcadeStorage.setHighScoreIfBetter(currentGameDef.id, currentGame.score);
    finalScoreEl.textContent =
      window.ArcadeI18n.t('finalScorePrefix') + currentGame.score +
      (isNewHi ? window.ArcadeI18n.t('newHighScoreSuffix') : '');
    finalScoreEl.classList.toggle('record', isNewHi);
    setState(STATE.GAME_OVER);
  }

  function updateScoreDisplay(score) {
    if (score === shownScore) return;
    const increased = shownScore !== null && score > shownScore;
    shownScore = score;
    scoreValueEl.textContent = String(score);
    if (increased) {
      scoreValueEl.classList.remove('bump');
      void scoreValueEl.offsetWidth;
      scoreValueEl.classList.add('bump');
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);

    if (!currentGame || (state !== STATE.PLAYING && state !== STATE.COUNTDOWN)) {
      lastTime = now;
      return;
    }

    let frameTime = now - lastTime;
    lastTime = now;
    if (frameTime > 250) frameTime = 250; // tab was backgrounded, don't spiral

    if (state === STATE.COUNTDOWN) {
      countdownRemaining -= frameTime;
      setCountdownNumber(Math.max(1, Math.ceil(countdownRemaining / 1000)));
      currentGame.draw(ctx); // keep the board visible under the countdown
      if (countdownRemaining <= 0) setState(STATE.PLAYING);
      return;
    }

    accumulator += frameTime;

    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
      currentGame.update(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps++;
    }

    currentGame.draw(ctx);
    updateScoreDisplay(currentGame.score);

    if (currentGame.isOver) {
      if (overTimer === null) overTimer = currentGame.deathMs || 0;
      overTimer -= frameTime;
      if (overTimer <= 0) {
        overTimer = null;
        handleGameOver();
      }
    }
  }

  function onAction(action) {
    if (action === 'BACK') {
      if (state !== STATE.MENU) goToMenu();
      return;
    }
    if (action === 'PAUSE') {
      if (state === STATE.PLAYING || state === STATE.COUNTDOWN) pauseGame();
      else if (state === STATE.PAUSED) resumeGame();
      return;
    }
    if ((state === STATE.PLAYING || state === STATE.COUNTDOWN) && currentGame) {
      currentGame.onInput(action);
    }
  }

  function initSoundToggle() {
    const enabled = window.ArcadeStorage.getSoundEnabled();
    soundBtn.textContent = enabled ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(enabled));
    soundBtn.addEventListener('click', () => {
      const next = !window.ArcadeStorage.getSoundEnabled();
      window.ArcadeStorage.setSoundEnabled(next);
      soundBtn.textContent = next ? '🔊' : '🔇';
      soundBtn.setAttribute('aria-pressed', String(next));
    });
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = window.ArcadeI18n.t(el.dataset.i18n);
    });
    langButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === window.ArcadeI18n.getLang());
    });
    document.documentElement.lang = window.ArcadeI18n.getLang();
  }

  function openSettings() {
    settingsOpen = true;
    refreshMenuVisibility();
  }

  function closeSettings() {
    settingsOpen = false;
    refreshMenuVisibility();
  }

  function initSettings() {
    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    langButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        window.ArcadeI18n.setLang(btn.dataset.lang);
        applyTranslations();
        renderMenu();
      });
    });
  }

  resumeBtn.addEventListener('click', resumeGame);
  pauseMenuBtn.addEventListener('click', goToMenu);
  retryBtn.addEventListener('click', retryGame);
  menuBtn.addEventListener('click', goToMenu);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', pauseGame);

  window.ArcadeInput.init({ canvas, backBtn, pauseBtn, onAction, logicalSize: LOGICAL_SIZE });

  if (document.fonts && document.fonts.load) {
    document.fonts.load('10px "Press Start 2P"');
    document.fonts.load('10px "Press Start 2P"', 'Привет');
  }

  initSoundToggle();
  initSettings();
  applyTranslations();
  renderMenu();
  setState(STATE.MENU);
  requestAnimationFrame(loop);
})();
