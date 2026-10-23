(function () {
  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= r * r;
  }

  // Pre-renders static art once into an offscreen canvas at the main canvas' pixel density,
  // so backgrounds stay crisp on hi-dpi screens and cost one drawImage per frame.
  function createLayer(ctx, w, h, paint) {
    const scale = ctx.getTransform().a || 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    g.imageSmoothingEnabled = false;
    paint(g);
    return {
      draw(target, x, y) {
        target.drawImage(canvas, x || 0, y || 0, w, h);
      }
    };
  }

  window.ArcadeUtils = { clamp, circleRectOverlap, createLayer };
})();
