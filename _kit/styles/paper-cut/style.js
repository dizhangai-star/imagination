// Paper-cut diorama (kağıt kesik) style pack, from baby-leyi. Load after engine/core.js.
// const S = Kit.styles.paperCut(x, { PAL, ZH, EN, K }) → piece/P/hang/paperText/banner/… bound to ctx x.
// Works in 640×360 logical units scaled by K (3 → 1080p). The paper look (fibre texture, cut-edge rim,
// lifted drop shadows, eBack pop-ins, threads, hanging cards) is ported from
// yasinozmeen/animasyon-stil-katalogu/stiller/kagit-kesik.
Kit.styles.paperCut = (x, o = {}) => {
  const PAL = o.PAL, ZH = o.ZH ?? '"LXGW WenKai TC", serif', EN = o.EN ?? '"Fraunces", Georgia, serif', K = o.K ?? 3;
  const { cl, lerp, seg, eOut, eIn, eBack, R, shade } = Kit.math;

  // ---------- paper fibre texture (device pixels, built once) ----------
  const TEX = document.createElement('canvas'); TEX.width = TEX.height = 768;
  {
    const c = TEX.getContext('2d'), r = R(7);
    for (let i = 0; i < 300; i++) {             // soft blotches
      const px = r() * 768, py = r() * 768, rad = 8 + r() * 40, dark = r() < 0.5;
      const g = c.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, dark ? 'rgba(0,0,0,0.014)' : 'rgba(255,255,255,0.01)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    c.lineCap = 'round';
    for (let i = 0; i < 2200; i++) {            // fibres
      const px = r() * 768, py = r() * 768, a = r() * Math.PI * 2, l = 3 + r() * 9, dark = r() < 0.5;
      c.strokeStyle = dark ? `rgba(0,0,0,${0.03 + r() * 0.05})` : `rgba(255,255,255,${0.035 + r() * 0.05})`;
      c.lineWidth = 0.5 + r() * 0.6; c.beginPath(); c.moveTo(px, py);
      c.quadraticCurveTo(px + Math.cos(a + 0.6) * l * 0.5, py + Math.sin(a + 0.6) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); c.stroke();
    }
    for (let i = 0; i < 5000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.05)'; c.fillRect(r() * 768, r() * 768, 1.2, 1.2); }
  }
  const TEXPAT = x.createPattern(TEX, 'repeat');
  function texture(a = 1) {                     // fill the current clip with fibre texture at device resolution
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha *= a; x.fillStyle = TEXPAT; x.fillRect(0, 0, 1920, 1080); x.restore();
  }

  // ---------- light ----------
  // LIGHT = shadow offset per unit of height (logical). Scenes may call E.light(angle) each frame
  // (angle = direction the shadow falls; π/2 = straight down). Reset to the default every frame.
  let LIGHT = [0.8, 1.2];
  function light(angle = 0.98, len = 1.45) { LIGHT = [Math.cos(angle) * len, Math.sin(angle) * len]; return LIGHT; }
  const devScale = () => { const m = x.getTransform(); return Math.hypot(m.a, m.b); };

  // ---------- paths (each returns a function that builds the path on x) ----------
  function loop(pts, n = 12) {                 // closed Catmull-Rom through pts
    const o = [], m = pts.length;
    for (let i = 0; i < m; i++) {
      const p0 = pts[(i - 1 + m) % m], p1 = pts[i], p2 = pts[(i + 1) % m], p3 = pts[(i + 2) % m];
      for (let j = 0; j < n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u;
        o.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
      }
    }
    return o;
  }
  const P = {
    poly: (pts) => () => { x.beginPath(); pts.forEach((q, i) => (i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); },
    blob: (pts) => P.poly(loop(pts)),
    rect: (rx, ry, w, h) => () => { x.beginPath(); x.rect(rx, ry, w, h); },
    rrect: (rx, ry, w, h, r) => () => { x.beginPath(); x.roundRect(rx, ry, w, h, r); },
    circle: (cx, cy, r) => () => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); },
    ellipse: (cx, cy, rx, ry, rot = 0) => () => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); },
    heart: (cx, cy, s) => () => {
      x.beginPath(); x.moveTo(cx, cy + s * 0.9);
      x.bezierCurveTo(cx - s * 1.25, cy + s * 0.1, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.35);
      x.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.25, cy + s * 0.1, cx, cy + s * 0.9); x.closePath();
    },
    star: (cx, cy, ro, ri, n = 5, rot = -Math.PI / 2) => () => {
      x.beginPath();
      for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      x.closePath();
    },
  };
  // Ground/hill layer: a smooth top edge through `tops` (sorted by x), filled down to yb.
  function strip(tops, yb = 420) {
    const pts = [], n = 10;
    for (let i = 0; i < tops.length - 1; i++) {
      const p0 = tops[Math.max(i - 1, 0)], p1 = tops[i], p2 = tops[i + 1], p3 = tops[Math.min(i + 2, tops.length - 1)];
      for (let j = 0; j < n; j++) {
        const u = j / n, u2 = u * u, u3 = u2 * u;
        pts.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3)));
      }
    }
    pts.push(tops[tops.length - 1]);
    return P.poly([[tops[0][0], yb], ...pts, [tops[tops.length - 1][0], yb]]);
  }

  // ---------- the paper piece ----------
  // piece(path, colour, { z: height above what's behind (shadow length/blur), alpha, rim, sh: shadow strength,
  //                       tex: texture strength, detail: fn drawn clipped inside the piece (after texture) })
  function piece(path, col, o = {}) {
    const a = o.alpha ?? 1; if (a <= 0) return;
    const z = o.z ?? 1, k = devScale(), L = LIGHT;
    x.save(); x.globalAlpha *= a;
    // 1. light cut-edge colour, casting the drop shadow (shadow params are in device px)
    if (z > 0) {
      x.shadowColor = `rgba(18,12,24,${o.sh ?? 0.5})`;
      x.shadowBlur = (1 + z * 1.4) * k; x.shadowOffsetX = L[0] * z * k; x.shadowOffsetY = L[1] * z * k;
    }
    path(); x.fillStyle = shade(col, o.rim ?? 1.16); x.fill();
    x.shadowColor = 'transparent';
    // 2. main colour shifted toward the shadow → a thin lit lip remains on the edge facing the light
    x.clip();
    const len = Math.hypot(L[0], L[1]) || 1;
    x.save(); x.translate((L[0] / len) * 0.75, (L[1] / len) * 0.75); path(); x.fillStyle = col; x.fill(); x.restore();
    if (o.detail) o.detail();
    texture(o.tex ?? 1);
    x.restore();
  }
  // Flat ink marks (eyes, mouths, stitches) — no shadow, slight emboss.
  function mark(fn, col = PAL.ink, w = 1.2) {
    x.save(); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
    fn(x); x.restore();
  }
  function thread(ax, ay, bx, by, a = 1, col = 'rgba(250,244,230,0.85)') {
    if (a <= 0) return;
    x.save(); x.globalAlpha *= a; x.strokeStyle = 'rgba(20,14,26,0.22)'; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(ax + LIGHT[0] * 2, ay + LIGHT[1] * 2); x.lineTo(bx + LIGHT[0] * 2, by + LIGHT[1] * 2); x.stroke();
    x.strokeStyle = col; x.lineWidth = 0.55; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); x.restore();
  }
  // Group transform: at(tx, ty, fn, { s, rot, sx, sy, ox, oy }) — rotate/scale about (ox, oy) in local coords.
  function at(tx, ty, fn, o = {}) {
    x.save(); x.translate(tx, ty); if (o.rot) x.rotate(o.rot);
    const sx = (o.s ?? 1) * (o.sx ?? 1), sy = (o.s ?? 1) * (o.sy ?? 1); if (sx !== 1 || sy !== 1) x.scale(sx, sy);
    fn(); x.restore();
  }

  // ---------- motion helpers ----------
  // cue(kind, t0): while audio/cues.mjs scans a scene (window.__cues is a Map), note each motion start for the SFX track.
  const cue = (k, t0) => { const c = window.__cues; if (c && Number.isFinite(t0)) { const key = `${k}@${t0.toFixed(2)}`; if (!c.has(key)) c.set(key, window.__t); } };
  const rise = (t, t0, d = 0.8, dist = 260, s = 1.35) => (cue('rise', t0), (1 - eBack(seg(t, t0, t0 + d), s)) * dist);   // up from below
  const sink = (t, t1, d = 0.6, dist = 320) => eIn(seg(t, t1, t1 + d)) * dist;                      // back down
  const pop = (t, t0, d = 0.45, s = 2.2) => (cue('pop', t0), t < t0 ? 0 : eBack(seg(t, t0, t0 + d), s));             // scale 0 → 1 with overshoot
  // A piece hanging on a thread from (ax, -10): drops in at t0 with a bounce, sways, is pulled back up at t1.
  // draw(ex, ey, rot) paints the hanging piece with its top at (ex, ey).
  function hang(t, ax, len, t0, draw, o = {}) {
    cue('hang', t0);
    if (t < t0) return;
    const top = o.top ?? -12, t1 = o.t1 ?? 1e9, ph = o.ph ?? 0;
    const drop = eBack(seg(t, t0, t0 + 0.8), 2.4), pull = eIn(seg(t, t1, t1 + 0.6));
    const Lh = (len - top + 40) * drop * (1 - pull) + top - 40;
    if (Lh <= top - 20) return;
    const age = t - t0, sw = (o.swing ?? 0.2) * Math.exp(-age * 0.6) * Math.sin(age * 3.1 + ph) + (o.idle ?? 0.03) * Math.sin(t * 1.25 + ph);
    const ex = ax + Math.sin(sw) * (Lh - top), ey = top + Math.cos(sw) * (Lh - top);
    thread(ax, top, ex, ey);
    draw(ex, ey, -sw);
  }

  // ---------- backdrops ----------
  function board(col = PAL.board) { x.save(); x.fillStyle = col; x.fillRect(0, 0, 640, 360); x.beginPath(); x.rect(0, 0, 640, 360); x.clip(); texture(); x.restore(); }
  function sky(top, bottom, y0 = 0, y1 = 360) {
    x.save(); const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fillRect(0, 0, 640, 360); x.beginPath(); x.rect(0, 0, 640, 360); x.clip(); texture(); x.restore();
  }
  function vignette(a = 0.28) {                  // diorama-box falloff
    x.save(); const g = x.createRadialGradient(320, 170, 120, 320, 180, 420);
    g.addColorStop(0, 'rgba(30,18,24,0)'); g.addColorStop(1, `rgba(30,18,24,${a})`); x.fillStyle = g; x.fillRect(0, 0, 640, 360); x.restore();
  }

  // ---------- paper text ----------
  // Each unit (char for zh, word for en: split=' ') is a separately cut piece that pops on in turn.
  function paperText(s, cx, cy, o = {}) {
    const p0 = o.t0 ?? 0, t = o.t ?? 1e9, size = o.size ?? 20, font = `${o.weight ?? 900} ${o.italic ? 'italic ' : ''}${size}px ${o.font ?? EN}`;
    const units = o.split === undefined ? [s] : s.split(o.split), gap = o.split === ' ' ? size * 0.28 : (o.gap ?? 0);
    x.save(); x.font = font; x.textBaseline = 'alphabetic'; x.textAlign = 'center';
    const ws = units.map((u) => x.measureText(u).width), tw = ws.reduce((a, b) => a + b, 0) + gap * (units.length - 1);
    let ux = o.align === 'left' ? cx : o.align === 'right' ? cx - tw : cx - tw / 2;
    const k = devScale(), z = o.z ?? 1;
    units.forEach((u, i) => {
      cue('pop', p0 + i * (o.stagger ?? 0.1));
      const p = seg(t, p0 + i * (o.stagger ?? 0.1), p0 + i * (o.stagger ?? 0.1) + (o.d ?? 0.45));
      const a = (o.alpha ?? 1) * (o.out !== undefined ? 1 - seg(t, o.out, o.out + 0.35) : 1);
      if (p > 0 && a > 0) {
        const sc = o.pop === false ? 1 : eBack(p, 2.4), lift = (1 - eOut(p)) * 10;
        x.save(); x.globalAlpha *= a * cl(p * 3); x.translate(ux + ws[i] / 2, cy - lift); x.rotate((1 - eOut(p)) * (i % 2 ? 0.12 : -0.1)); x.scale(sc, sc);
        x.shadowColor = 'rgba(20,12,30,0.4)'; x.shadowBlur = (1.5 + z + lift * 0.3) * k;
        x.shadowOffsetX = LIGHT[0] * (z + lift * 0.1) * k; x.shadowOffsetY = LIGHT[1] * (z + lift * 0.1) * k;
        x.fillStyle = o.col ?? PAL.navy; x.fillText(u, 0, 0);
        x.shadowColor = 'transparent'; x.strokeStyle = 'rgba(255,255,255,0.2)'; x.lineWidth = Math.max(0.3, size / 60); x.strokeText(u, 0, 0);
        x.restore();
      }
      ux += ws[i] + gap;
    });
    x.restore();
    return tw;
  }

  // ---------- confetti ----------
  function confetti(t, t0, cx, cy, o = {}) {
    cue('confetti', t0);
    if (t < t0) return;
    const n = o.n ?? 24, r = R(o.seed ?? 5), cols = o.cols ?? [PAL.pink, PAL.rose, PAL.cream, PAL.sun, PAL.terra];
    const age = t - t0, dur = o.dur ?? 3.2;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (r() - 0.5) * (o.spread ?? 2.4), v = 70 + r() * 110, spin = (r() - 0.5) * 9, sz = 2.4 + r() * 2.6;
      const col = cols[Math.floor(r() * cols.length)], kind = r(), ph = r() * 6;
      const drag = 1 - Math.exp(-age * 2.2);
      const px = cx + Math.cos(a) * v * drag / 2.2 + Math.sin(age * 2 + ph) * 6;
      const py = cy + Math.sin(a) * v * drag / 2.2 + age * age * 18 + age * 14;
      const alpha = 1 - seg(age, dur - 0.6, dur);
      if (alpha <= 0 || py > 380) continue;
      at(px, py, () => {
        const path = kind < 0.4 ? P.heart(0, 0, sz) : kind < 0.7 ? P.rect(-sz, -sz * 0.6, sz * 2, sz * 1.2) : P.circle(0, 0, sz * 0.8);
        piece(path, col, { z: 0.8, alpha, tex: 0.6 });
      }, { rot: spin * age, sx: 0.4 + 0.6 * Math.abs(Math.cos(age * 4 + ph)) });
    }
  }

  // ---------- caption banner ----------
  // A cream card hanging on two threads at the top, dropping in with a bounce: 中文 above, English below.
  function banner(t, cap, T) {
    if (!cap || !T.cap) return;
    const [a, b] = T.cap; if (t < a || t > b + 0.7) return;
    const drop = eBack(seg(t, a, a + 0.8), 1.9), pull = eIn(seg(t, b, b + 0.6));
    x.save();
    x.font = `700 17px ${ZH}`; const wz = x.measureText(cap.zh).width;
    x.font = `italic 500 11.5px ${EN}`; const we = x.measureText(cap.en).width;
    x.restore();
    const w = Math.max(wz, we) + 34, h = 46, cx = 320, y = lerp(-70, 14, drop) - pull * 90;
    const age = t - a, rot = 0.05 * Math.exp(-age * 1.4) * Math.sin(age * 4.2) + 0.006 * Math.sin(t * 1.3);
    thread(cx - w / 2 + 14, -10, cx - w / 2 + 14, y + 3); thread(cx + w / 2 - 14, -10, cx + w / 2 - 14, y + 3);
    at(cx, y, () => {
      piece(P.rrect(-w / 2 + 1.4, 1.4, w, h, 7), PAL.kraft, { z: 1.2, sh: 0.3 });
      piece(P.rrect(-w / 2, 0, w, h, 7), PAL.cream, { z: 0.5 });
      [-w / 2 + 14, w / 2 - 14].forEach((hx) => piece(P.circle(hx, 4, 1.8), PAL.terra, { z: 0.4 }));
      x.save(); x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.font = `700 17px ${ZH}`; x.fillStyle = PAL.navy; x.fillText(cap.zh, 0, 23);
      x.font = `italic 500 11.5px ${EN}`; x.fillStyle = PAL.terra; x.fillText(cap.en, 0, 38);
      x.restore();
    }, { rot });
  }

  function fadeBoard(a) { if (a > 0) { x.save(); x.globalAlpha = a; board(); x.restore(); } }

  return {
    texture, light, devScale, loop, P, strip, piece, mark, thread, at, cue, rise, sink, pop, hang,
    board, sky, vignette, paperText, confetti, banner, fadeBoard,
    get LIGHT() { return LIGHT; },
  };
};
