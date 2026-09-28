// Kit core: math, easing, seeded RNG and colour helpers shared by every style and film.
// Loaded as a classic <script> before the style pack; everything hangs off window.Kit so films can
// destructure what they use (const { cl, seg, eOut } = Kit.math) without global name clashes.
(() => {
  const Kit = (window.Kit = window.Kit || { styles: {} });
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (t, a, b) => cl((t - a) / (b - a));                 // 0→1 progress of t across [a, b]
  const eOut = (p) => 1 - Math.pow(1 - cl(p), 3);
  const eIn = (p) => Math.pow(cl(p), 3);
  const eInOut = (p) => { p = cl(p); return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const eBack = (p, s = 1.7) => { p = cl(p); const c = s + 1; return 1 + c * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2); };
  // Seeded LCG in [0, 1). Never use Math.random(): every frame must render the same in any order.
  function R(s) { s = s >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const shade = (h, k) => `rgb(${hex(h).map((v) => Math.round(cl(v * k, 0, 255))).join(',')})`;
  const mixHex = (a, b, u) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], u))).join(',')})`; };
  // Catmull-Rom: open spline through pts (n samples per segment), and a closed loop with no seam.
  const cr = (p0, p1, p2, p3, u) => {
    const u2 = u * u, u3 = u2 * u;
    return [0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3));
  };
  function spline(pts, n = 40) {
    const o = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      for (let j = 0; j < n; j++) o.push(cr(p0, p1, p2, p3, j / n));
    }
    o.push(pts[pts.length - 1]);
    return o;
  }
  function loop(pts, n = 12) {
    const o = [], m = pts.length;
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) o.push(cr(pts[(i - 1 + m) % m], pts[i], pts[(i + 1) % m], pts[(i + 2) % m], j / n));
    return o;
  }
  Kit.math = { cl, lerp, seg, eOut, eIn, eInOut, eBack, ez: eOut, R, hex, shade, mixHex, spline, loop };
})();
