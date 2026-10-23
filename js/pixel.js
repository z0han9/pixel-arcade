(function () {
  // Bitmaps are arrays of equal-length strings; each char maps to a colour via `palette`,
  // any char without an entry (e.g. '.') is transparent.

  function draw(ctx, bitmap, palette, x, y, scale) {
    for (let r = 0; r < bitmap.length; r++) {
      const row = bitmap[r];
      for (let c = 0; c < row.length; c++) {
        const color = palette[row[c]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }

  function toSvg(bitmap, palette) {
    const h = bitmap.length;
    const w = bitmap[0].length;
    let rects = '';
    for (let r = 0; r < h; r++) {
      const row = bitmap[r];
      let c = 0;
      while (c < w) {
        const color = palette[row[c]];
        if (!color) {
          c++;
          continue;
        }
        let end = c + 1;
        while (end < w && palette[row[end]] === color) end++;
        rects += '<rect x="' + c + '" y="' + r + '" width="' + (end - c) + '" height="1" fill="' + color + '"/>';
        c = end;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" shape-rendering="crispEdges">' + rects + '</svg>';
  }

  window.ArcadePixel = { draw, toSvg };
})();
