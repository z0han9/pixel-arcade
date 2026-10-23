(function () {
  const reduced = window.ArcadeTheme.reducedMotion;

  // Square pixel particles + floating text labels, all time-based (dt in ms).
  function createEmitter() {
    const particles = [];
    const floaters = [];

    function burst(x, y, color, count, opts) {
      if (reduced) return;
      const o = opts || {};
      const speed = o.speed || 0.3;
      const size = o.size || 4;
      const life = o.life || 500;
      const gravity = o.gravity === undefined ? 0.0006 : o.gravity;
      const spread = o.spread === undefined ? Math.PI * 2 : o.spread;
      const angle = o.angle === undefined ? 0 : o.angle;
      for (let i = 0; i < count; i++) {
        const a = angle + (Math.random() - 0.5) * spread;
        const s = speed * (0.4 + Math.random() * 0.6);
        particles.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          size: Math.max(2, Math.round(size * (0.6 + Math.random() * 0.6))),
          life, max: life, gravity,
          color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color
        });
      }
    }

    function float(x, y, text, color) {
      if (reduced) return;
      floaters.push({ x, y, text, color, life: 800, max: 800 });
    }

    function update(dt) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt;
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        if (f.life <= 0) {
          floaters.splice(i, 1);
          continue;
        }
        f.y -= 0.035 * dt;
      }
    }

    function draw(ctx) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;
      if (floaters.length) {
        ctx.font = window.ArcadeTheme.font(10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < floaters.length; i++) {
          const f = floaters[i];
          ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2);
          ctx.fillStyle = '#08060D';
          ctx.fillText(f.text, Math.round(f.x) + 2, Math.round(f.y) + 2);
          ctx.fillStyle = f.color;
          ctx.fillText(f.text, Math.round(f.x), Math.round(f.y));
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }

    function clear() {
      particles.length = 0;
      floaters.length = 0;
    }

    return { burst, float, update, draw, clear };
  }

  function createShake() {
    let remaining = 0;
    let duration = 1;
    let power = 0;

    return {
      trigger(p, ms) {
        if (reduced) return;
        power = p;
        duration = ms;
        remaining = ms;
      },
      update(dt) {
        remaining = Math.max(0, remaining - dt);
      },
      offset() {
        if (remaining <= 0) return { x: 0, y: 0 };
        const k = (remaining / duration) * power;
        return { x: Math.round((Math.random() * 2 - 1) * k), y: Math.round((Math.random() * 2 - 1) * k) };
      },
      active() {
        return remaining > 0;
      }
    };
  }

  window.ArcadeFx = { createEmitter, createShake };
})();
