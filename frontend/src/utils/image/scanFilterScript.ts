/**
 * Pure-browser image filter code (canvas). Kept as a string so the exact same
 * code runs inside a hidden WebView on Android/iOS and directly on web — fully
 * offline, no server round-trip.
 *
 * Defines: window.__scanFilter(src: string, mode: "bw" | "boost") => Promise<dataURL>
 */
export const SCAN_FILTER_JS = String.raw`
(function () {
  function load(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error("Could not read image")); };
      img.src = src;
    });
  }
  function range(hist, total, cut) {
    var lo = 0, hi = 255, acc = 0, lim = total * cut;
    for (lo = 0; lo < 255; lo++) { acc += hist[lo]; if (acc > lim) break; }
    acc = 0;
    for (hi = 255; hi > 0; hi--) { acc += hist[hi]; if (acc > lim) break; }
    if (hi <= lo) { lo = 0; hi = 255; }
    return [lo, hi];
  }
  window.__scanFilter = function (src, mode) {
    return load(src).then(function (img) {
      var MAX = 2200;
      var s = Math.min(1, MAX / Math.max(img.width, img.height));
      var w = Math.round(img.width * s), h = Math.round(img.height * s);
      var c = document.createElement("canvas"); c.width = w; c.height = h;
      var ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      var id = ctx.getImageData(0, 0, w, h), d = id.data, n = w * h, i, p;

      if (mode === "bw") {
        // Background (lighting) estimate: downscale then upscale = cheap big blur.
        var sw = Math.max(1, Math.round(w / 32)), sh = Math.max(1, Math.round(h / 32));
        var sc = document.createElement("canvas"); sc.width = sw; sc.height = sh;
        var sctx = sc.getContext("2d"); sctx.imageSmoothingEnabled = true;
        sctx.drawImage(c, 0, 0, sw, sh);
        var bc = document.createElement("canvas"); bc.width = w; bc.height = h;
        var bctx = bc.getContext("2d"); bctx.imageSmoothingEnabled = true;
        bctx.drawImage(sc, 0, 0, w, h);
        var bd = bctx.getImageData(0, 0, w, h).data;
        var flat = new Uint8ClampedArray(n), hist = new Uint32Array(256);
        for (i = 0, p = 0; i < n; i++, p += 4) {
          var g = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
          var b = Math.max(1, 0.299 * bd[p] + 0.587 * bd[p + 1] + 0.114 * bd[p + 2]);
          var v = Math.min(255, (g / b) * 255);
          flat[i] = v; hist[flat[i]]++;
        }
        var r = range(hist, n, 0.02), lo = r[0], span = Math.max(1, r[1] - r[0]);
        for (i = 0, p = 0; i < n; i++, p += 4) {
          var q = Math.max(0, Math.min(255, ((flat[i] - lo) * 255) / span));
          q = q > 170 ? 255 : q * 0.6;
          d[p] = d[p + 1] = d[p + 2] = q;
        }
      } else {
        var hs = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], k;
        for (p = 0; p < d.length; p += 4) { hs[0][d[p]]++; hs[1][d[p + 1]]++; hs[2][d[p + 2]]++; }
        var rr = [range(hs[0], n, 0.01), range(hs[1], n, 0.01), range(hs[2], n, 0.01)];
        for (p = 0; p < d.length; p += 4) {
          var ch = [0, 0, 0];
          for (k = 0; k < 3; k++) ch[k] = ((d[p + k] - rr[k][0]) * 255) / Math.max(1, rr[k][1] - rr[k][0]);
          var gy = 0.299 * ch[0] + 0.587 * ch[1] + 0.114 * ch[2];
          for (k = 0; k < 3; k++) {
            var x = gy + (ch[k] - gy) * 1.5;      // saturation
            x = (x - 128) * 1.2 + 128;            // contrast
            d[p + k] = x;                          // clamped by Uint8ClampedArray
          }
        }
      }
      ctx.putImageData(id, 0, 0);
      return c.toDataURL("image/jpeg", 0.85);
    });
  };
})();
`;
