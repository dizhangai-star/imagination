// Ink-wash (水墨) style pack, from chinese-zodiac. Load after engine/core.js.
// const S = Kit.styles.inkWash(x, { INK, PAPER, SEAL, ZH, sealText }) → brush/ribbon/mass/wash/… bound to ctx x.
// Works in 640×360 logical units (the film sets x.setTransform(3, 0, 0, 3, 0, 0) once).
// Its RNG and ez are the zodiac originals (Park–Miller, unclamped ez), kept so existing art renders identically.
Kit.styles.inkWash = (x, o = {}) => {
  const INK = o.INK ?? '#161614', PAPER = o.PAPER ?? '#efe6d2', SEAL = o.SEAL ?? '#b8322a', ZH = o.ZH ?? '"LXGW WenKai TC", serif';
  const { cl, seg, spline } = Kit.math;
  const ez = (p) => 1 - Math.pow(1 - p, 3);
  function R(s) { return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  const loop = (pts, n = 16) => Kit.math.loop(pts, n);
  function circle(cx, cy, r, n = 24, start = -1.2) {
    const o = [];
    for (let i = 0; i <= n; i++) { const a = start + (i / n) * Math.PI * 2; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return o;
  }

  // ---------- taper profiles (u = 0..1 along the stroke) ----------
  const taper = {
    even: (u) => 0.3 + 0.7 * Math.sin(Math.PI * cl(u * 1.02)),          // thin–thick–thin
    head: (u) => 0.08 + 0.92 * Math.pow(Math.sin(Math.PI * cl(u * 0.62)), 0.8), // thin tail, thick end
    leaf: (u) => 0.15 + 0.85 * Math.pow(Math.sin(Math.PI * u), 1.4),
    flat: () => 1,
  };

  // ---------- brush primitives ----------
  // Dry-brush stroke revealed along its length by p (0..1).
  function brush(pts, w, p, al = 0.6, seed = 1, tp = taper.even, col = INK) {
    if (p <= 0) return;
    const P = spline(pts), r = R(seed), N = Math.floor(P.length * p);
    x.fillStyle = col;
    for (let i = 0; i < N; i++) {
      const u = i / P.length, tw = w * tp(u);
      for (let k = 0; k < 3; k++) {
        x.globalAlpha = al * (0.25 + 0.5 * r());
        x.beginPath();
        x.arc(P[i][0] + (r() - 0.5) * tw * 0.45, P[i][1] + (r() - 0.5) * tw * 0.45, tw * (0.3 + 0.4 * r()), 0, 7);
        x.fill();
      }
    }
    x.globalAlpha = 1;
  }
  // Smooth wet-brush stroke: filled tapered outline + soft bleed + faint 飛白 dry streaks.
  // Better than brush() for long, clean bodies (snake, dragon, tails).
  function ribbon(pts, w, p, al = 0.8, tp = taper.even, seed = 1, col = INK) {
    if (p <= 0) return;
    const P = spline(pts, 60), N = Math.max(2, Math.floor(P.length * p));
    const edge = (scale, off = 0) => {
      const L = [], Rt = [];
      for (let i = 0; i < N; i++) {
        const a = P[Math.max(i - 1, 0)], b = P[Math.min(i + 1, P.length - 1)];
        const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len, hw = (w / 2) * tp(i / P.length) * scale;
        L.push([P[i][0] + nx * (hw + off), P[i][1] + ny * (hw + off)]);
        Rt.push([P[i][0] - nx * (hw - off), P[i][1] - ny * (hw - off)]);
      }
      return { L, Rt };
    };
    // One closed outline per layer: left edge → semicircular cap round the tip → right edge back.
    // The cap is part of the same path, so nothing overlaps and no darker dot appears.
    const fill = (scale, a) => {
      const { L, Rt } = edge(scale);
      x.globalAlpha = a; x.fillStyle = col; x.beginPath();
      L.forEach((q, i) => (i ? x.lineTo(...q) : x.moveTo(...q)));
      const tip = P[N - 1], prev = P[Math.max(N - 2, 0)];
      // cap radius never exceeds the width just ahead, so a narrowing end (snout) grows in without a knob
      const uTip = (N - 1) / P.length;
      const r = (w / 2) * Math.min(tp(uTip), tp(Math.min(1, uTip + 0.015)), tp(Math.min(1, uTip + 0.03))) * scale;
      const angN = Math.atan2(tip[0] - prev[0], -(tip[1] - prev[1]));   // angle of the left normal
      if (r > 0.05) x.arc(tip[0], tip[1], r, angN, angN - Math.PI, true);
      for (let i = Rt.length - 1; i >= 0; i--) x.lineTo(...Rt[i]);
      x.closePath(); x.fill();
    };
    fill(1.3, al * 0.06);           // outer bleed
    fill(1.12, al * 0.08);          // inner bleed
    fill(1.0, al * 0.85);           // body
    // 飛白: the brush runs dry at the start of the stroke — fine paper-coloured
    // lines along the first ~30%, stronger toward the very end.
    const r = R(seed), dryEnd = Math.min(N, Math.floor(P.length * 0.3));
    x.strokeStyle = PAPER; x.lineCap = 'round';
    const nrm = (k) => { const a = P[Math.max(k - 1, 0)], b = P[Math.min(k + 1, P.length - 1)]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d]; };
    for (let s = 0; s < 7; s++) {
      const off = (r() - 0.5) * 1.5, len = Math.floor(dryEnd * (0.4 + 0.6 * r()));
      x.lineWidth = 0.35 + r() * 0.35;
      x.globalAlpha = 0.5 + 0.3 * r();
      x.beginPath();
      for (let k = 0; k < len; k += 2) {
        const n = nrm(k), hw = (w / 2) * tp(k / P.length) * off;
        k ? x.lineTo(P[k][0] + n[0] * hw, P[k][1] + n[1] * hw) : x.moveTo(P[k][0] + n[0] * hw, P[k][1] + n[1] * hw);
      }
      x.stroke();
    }
    x.globalAlpha = 1;
  }
  // Many faint, flattened ellipses build up a graded wash that is darkest at its core.
  function wash(cx, cy, rx, ry, al, p, seed = 3, col = '#2a2a26') {
    if (p <= 0) return;
    const r = R(seed);
    x.fillStyle = col;
    for (let i = 0; i < 90; i++) {
      const k = r();
      x.globalAlpha = al * p * (0.03 + 0.06 * r());
      x.beginPath();
      x.ellipse(cx + (r() - 0.5) * rx * (1.2 - k * 0.6), cy + (r() - 0.5) * ry * 0.6, rx * (0.2 + 0.5 * k), ry * (0.2 + 0.4 * k), (r() - 0.5) * 0.3, 0, 7);
      x.fill();
    }
    x.globalAlpha = 1;
  }
  // Horizontal ground mist along y, spanning the frame.
  function ground(y, p, seed = 11, al = 1) {
    if (p <= 0) return;
    const r = R(seed);
    x.fillStyle = '#2a2a26';
    for (let i = 0; i < 40; i++) {
      x.globalAlpha = al * p * (0.03 + 0.04 * r());
      x.beginPath();
      x.ellipse(r() * 640, y + r() * 30, 60 + r() * 120, 4 + r() * 10, 0, 0, 7);
      x.fill();
    }
    x.globalAlpha = 1;
  }
  // Rock: pale inner wash plus a few dry contour strokes.
  function rock(outline, p, seed = 5, fill = 0.6) {
    if (p <= 0) return;
    const xs = outline.map((q) => q[0]), ys = outline.map((q) => q[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    x.save();
    x.beginPath(); spline(outline, 12).forEach((q, i) => (i ? x.lineTo(...q) : x.moveTo(...q))); x.closePath(); x.clip();
    // shade heavier toward the lower-left, lighter at the top-right face
    wash(Math.min(...xs) + w * 0.35, Math.min(...ys) + h * 0.65, w * 0.9, h * 1.2, fill * 1.6, ez(seg(p, 0.3, 1)), seed);
    wash(Math.min(...xs) + w * 0.6, Math.min(...ys) + h * 0.4, w * 0.8, h * 0.9, fill * 0.6, ez(seg(p, 0.4, 1)), seed + 1);
    x.restore();
    const half = Math.ceil(outline.length * 0.6);
    brush(outline.slice(0, half), 3.4, ez(seg(p, 0, 0.5)), 0.75, seed, taper.even);
    brush(outline.slice(half - 1), 2.2, ez(seg(p, 0.35, 0.8)), 0.55, seed + 2, taper.even);
  }
  // Wet ink mass for soft bodies (rabbit, pig, rat): a closed outline filled with a pale
  // tone, a soft bled edge, and a darker wash pooled toward `shade` (offset from the centre,
  // in units of the half-size) so the form reads as round. Fades in with p.
  function mass(pts, p, al = 0.7, seed = 1, shade = [0.3, 0.5], col = INK) {
    if (p <= 0) return;
    const L = loop(pts), xs = L.map((q) => q[0]), ys = L.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2;
    const path = () => { x.beginPath(); L.forEach((q, i) => (i ? x.lineTo(...q) : x.moveTo(...q))); x.closePath(); };
    x.save();
    x.fillStyle = col;
    x.filter = 'blur(5px)'; x.globalAlpha = al * p * 0.25; path(); x.fill();   // bleed into the paper
    x.filter = 'blur(1.2px)'; x.globalAlpha = al * p * 0.45; path(); x.fill(); // pale body tone
    x.filter = 'none'; path(); x.clip();
    wash(cx + shade[0] * rx, cy + shade[1] * ry, rx * 1.6, ry * 1.8, al * 1.1, p, seed, col);
    x.restore();
    x.globalAlpha = 1;
  }
  // Filled ink blob (heads, eyes) fading in with p.
  function blob(cx, cy, rx, ry, rot, p, al = 0.85, col = INK) {
    if (p <= 0) return;
    x.globalAlpha = al * p; x.fillStyle = col;
    x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, 7); x.fill();
    x.globalAlpha = 1;
  }
  function moon(cx, cy, r, p) {
    if (p <= 0) return;
    x.globalAlpha = p * 0.45; x.strokeStyle = '#555'; x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); x.globalAlpha = 1;
  }

  // ---------- ground, type and seal ----------
  function paper() {
    x.globalAlpha = 1; x.fillStyle = PAPER; x.fillRect(0, 0, 640, 360);
    const r = R(7); x.fillStyle = '#000';
    for (let i = 0; i < 900; i++) { x.globalAlpha = 0.02; x.fillRect(r() * 640, r() * 360, 0.5 + r() * 2, 0.5); }
    x.globalAlpha = 1;
  }
  // Vertical title, inking in one character at a time with p.
  function vtext(s, cx, cy, size, p) {
    x.font = `700 ${size}px ${ZH}`; x.fillStyle = INK; x.textAlign = 'center'; x.textBaseline = 'top';
    [...s].forEach((c, i) => { x.globalAlpha = cl(p * s.length - i); x.fillText(c, cx, cy + i * size * 1.08); });
    x.globalAlpha = 1;
  }
  // Red square seal with two characters stacked.
  function seal(cx, cy, p, txt = o.sealText ?? '生肖') {
    if (p <= 0) return;
    const s = 0.6 + 0.4 * ez(p);
    x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha = p;
    x.fillStyle = SEAL; x.fillRect(-16, -16, 32, 32);
    x.fillStyle = '#f3e9d6'; x.font = `700 14px ${ZH}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt[0], 0, -7); x.fillText(txt[1], 0, 8);
    x.restore(); x.globalAlpha = 1;
  }
  function textLine(s, cx, cy, font, col, a) {
    if (a <= 0) return;
    x.globalAlpha = a; x.font = font; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillText(s, cx, cy); x.globalAlpha = 1;
  }

  return { cl, seg, ez, R, spline, loop, circle, taper, brush, ribbon, wash, ground, rock, mass, blob, moon, paper, vtext, seal, textLine, INK, PAPER, SEAL };
};
