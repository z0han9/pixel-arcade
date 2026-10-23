(function () {
  const cache = {};

  // Single source of truth for colours is css/style.css (:root tokens).
  function get(name) {
    if (!cache[name]) {
      cache[name] = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    }
    return cache[name];
  }

  function parse(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function toHex(rgb) {
    return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function mix(a, b, t) {
    const ca = parse(a);
    const cb = parse(b);
    return toHex(ca.map((v, i) => v + (cb[i] - v) * t));
  }

  // amount > 0 lightens towards white, < 0 darkens towards black
  function shade(hex, amount) {
    return amount >= 0 ? mix(hex, '#ffffff', amount) : mix(hex, '#000000', -amount);
  }

  function alpha(hex, a) {
    const [r, g, b] = parse(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.ArcadeTheme = {
    get,
    mix,
    shade,
    alpha,
    reducedMotion,
    font: function (px) {
      return px + 'px "Press Start 2P", monospace';
    }
  };
})();
