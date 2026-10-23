(function () {
  // Translates raw keyboard/touch/mouse events into abstract actions:
  // UP / DOWN / LEFT / RIGHT / ACTION / PAUSE / BACK.
  // Games never touch keyboard/touch events directly.
  //
  // Two flavors of input are exposed:
  //  - onAction(action) — a one-shot dispatch on key-down/tap/swipe (menus, Snake's turn queue).
  //  - isHeld(action) / getPointerX() — continuous state, polled from a game's update()
  //    loop (paddle-style games that need to move while a key/finger is held down).

  const KEY_MAP = {
    ArrowUp: 'UP', KeyW: 'UP',
    ArrowDown: 'DOWN', KeyS: 'DOWN',
    ArrowLeft: 'LEFT', KeyA: 'LEFT',
    ArrowRight: 'RIGHT', KeyD: 'RIGHT',
    Space: 'ACTION',
    KeyP: 'PAUSE',
    Escape: 'PAUSE'
  };

  const SWIPE_THRESHOLD = 30;
  const TAP_MAX_DIST = 10;
  const TAP_MAX_TIME_MS = 250;

  const heldActions = new Set();
  let pointerLogicalX = null;
  let logicalSize = 0;
  let trackedCanvas = null;

  function updatePointerFromClientX(clientX) {
    if (!trackedCanvas) return;
    const rect = trackedCanvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = (clientX - rect.left) / rect.width;
    pointerLogicalX = Math.max(0, Math.min(logicalSize, ratio * logicalSize));
  }

  function init({ canvas, backBtn, pauseBtn, onAction, logicalSize: ls }) {
    trackedCanvas = canvas || null;
    logicalSize = ls || 0;

    window.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      if (action === 'UP' || action === 'DOWN' || action === 'LEFT' || action === 'RIGHT') {
        heldActions.add(action);
        pointerLogicalX = null; // keyboard takes back control from pointer-follow
      }
      if (e.repeat) return;
      e.preventDefault();
      onAction(action);
    });

    window.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (action) heldActions.delete(action);
    });

    if (backBtn) backBtn.addEventListener('click', () => onAction('BACK'));
    if (pauseBtn) pauseBtn.addEventListener('click', () => onAction('PAUSE'));

    if (canvas) {
      let startX = 0;
      let startY = 0;
      let startTime = 0;

      canvas.addEventListener('touchstart', (e) => {
        const t = e.changedTouches[0];
        startX = t.clientX;
        startY = t.clientY;
        startTime = Date.now();
        updatePointerFromClientX(t.clientX);
      }, { passive: true });

      canvas.addEventListener('touchmove', (e) => {
        const t = e.changedTouches[0];
        updatePointerFromClientX(t.clientX);
      }, { passive: true });

      canvas.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        const dist = Math.hypot(dx, dy);
        const elapsed = Date.now() - startTime;

        if (dist >= SWIPE_THRESHOLD) {
          if (Math.abs(dx) > Math.abs(dy)) {
            onAction(dx > 0 ? 'RIGHT' : 'LEFT');
          } else {
            onAction(dy > 0 ? 'DOWN' : 'UP');
          }
        } else if (dist <= TAP_MAX_DIST && elapsed <= TAP_MAX_TIME_MS) {
          onAction('ACTION');
        }
      }, { passive: true });

      canvas.addEventListener('mousemove', (e) => {
        updatePointerFromClientX(e.clientX);
      });
    }
  }

  function isHeld(action) {
    return heldActions.has(action);
  }

  function getPointerX() {
    return pointerLogicalX;
  }

  window.ArcadeInput = { init, isHeld, getPointerX };
})();
