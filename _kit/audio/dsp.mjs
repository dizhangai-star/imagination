// Offline synthesis toolkit (no dependencies): seeded RNG, instrument voices, Freeverb, filters, WAV out.
// Everything writes into Float32Array stereo buses, so a film's music.mjs is just a score:
//
//   const SR = 48000, N = Math.ceil(secs * SR);
//   const L = new Float32Array(N), R = new Float32Array(N);        // music bus
//   const { rnd, jit } = rng(seed);
//   const V = voices({ sr: SR, n: N, rnd, music: [L, R], sfx: [SL, SR2] });
//   V.pluck({ t, m, v, pan, bend, vib, ring });   V.mbox(t, midi, v, pan);   V.noise(…);   V.glide(…)
//   const wl = freeverb(mono, 0, { sr: SR }), wr = freeverb(mono, 23, { sr: SR });   // + mix, then
//   writeWav(file, L, R, SR);                                                        // peak −1 dBFS
//
// The call order into rnd() is part of the sound: keep it stable and a score renders bit-identically.

export const hz = (m) => 440 * 2 ** ((m - 69) / 12);
export const panG = (p) => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
export const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Seeded LCG in [0, 1) and a ±a jitter drawing from the same stream.
export function rng(seed) {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return { rnd, jit: (a) => (rnd() * 2 - 1) * a };
}

// Instrument voices bound to buses. music = [L, R] (partials, mbox tones, pluck); sfx = [L, R] (noise, glide).
export function voices({ sr: SR = 48000, n: N, rnd, music, sfx = music }) {
  // Damped partials via a rotating phasor (cheap): parts [[freq, amp, decay s]], into bus (l, r).
  function partials(t, parts, pan, len, bus = music, atk = 0.002) {
    const s0 = Math.floor(t * SR), n = Math.min(Math.ceil(len * SR), N - s0); if (n <= 0 || s0 < 0) return;
    const [gl, gr] = panG(pan), [bl, br] = bus, fadeN = Math.min(n, SR * 0.04);
    for (const [f, a, d] of parts) {
      if (f >= SR / 2.2 || a <= 0) continue;
      const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), k = Math.exp(-1 / (d * SR));
      let re = 0, im = a;
      const an = Math.max(1, atk * SR);
      for (let i = 0; i < n; i++) {
        const y = im * (i < an ? i / an : 1) * (i > n - fadeN ? (n - i) / fadeN : 1);
        bl[s0 + i] += y * gl; br[s0 + i] += y * gr;
        const r2 = (re * c - im * s) * k; im = (re * s + im * c) * k; re = r2;
      }
    }
  }
  // Music-box tine: fundamental + weak octave + cantilever overtones (6.27×, 17.5×) that die fast, a tiny
  // detuned twin for shimmer, and a metallic pluck click (the click goes to the sfx bus unless bus is given).
  function mbox(t, m, v, pan = 0, bus) {
    const f = hz(m), tau = Math.min(3.2, Math.max(0.7, 1.7 * Math.sqrt(523 / f)));
    partials(t, [[f, v, tau], [f * 1.0009, v * 0.25, tau * 0.8], [f * 2, v * 0.12, tau * 0.35], [f * 3.01, v * 0.05, tau * 0.2],
      [f * 6.27, v * 0.2, 0.06], [f * 17.5, v * 0.06, 0.012]], pan, tau * 4.2, bus);
    noise(t, 0.004, v * 0.18, pan, bus, { bp: Math.min(9000, f * 8), q: 1.5 });
  }
  // Filtered noise burst: o.bp (centre Hz) / o.q, o.lp; envelope o.atk / o.dec / o.shape(u); o.sweep: [f0, f1].
  function noise(t, d, v, pan, bus = sfx, o = {}) {
    const s0 = Math.floor(t * SR), n = Math.min(Math.ceil(d * SR), N - s0); if (n <= 0 || s0 < 0) return;
    const [gl, gr] = panG(pan), [bl, br] = bus, atk = (o.atk ?? 0.002) * SR;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n, f0 = o.sweep ? o.sweep[0] + (o.sweep[1] - o.sweep[0]) * u : o.bp ?? 2000;
      const w = 2 * Math.PI * Math.min(f0, SR * 0.45) / SR, al = Math.sin(w) / (2 * (o.q ?? 1)), a0 = 1 + al;
      const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
      const xin = rnd() * 2 - 1, y = b0 * xin + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = xin; y2 = y1; y1 = y;
      lp += (o.lp ? 1 - Math.exp(-2 * Math.PI * o.lp / SR) : 1) * (y - lp);
      const env = (i < atk ? i / atk : 1) * (o.shape ? o.shape(u) : Math.exp(-i / (SR * (o.dec ?? d / 4))));
      bl[s0 + i] += lp * env * v * gl; br[s0 + i] += lp * env * v * gr;
    }
  }
  // Pitch-gliding sine: frequency fu(u) over d seconds.
  function glide(t, d, v, fu, pan, env = (u) => Math.exp(-u * 5), bus = sfx) {
    const s0 = Math.floor(t * SR), n = Math.min(Math.ceil(d * SR), N - s0); if (n <= 0) return;
    const [gl, gr] = panG(pan), [bl, br] = bus; let ph = 0;
    for (let i = 0; i < n; i++) { const u = i / n; ph += 2 * Math.PI * fu(u) / SR; const y = Math.sin(ph) * env(u) * v * Math.min(1, i / 48); bl[s0 + i] += y * gl; br[s0 + i] += y * gr; }
  }
  // Guzheng-style plucked string: additive bridge-pluck partials with inharmonicity, bends (按音, bend:
  // [start s, cents, glide s]), vibrato (揉弦, vib: cents), a fingernail click; ring: max seconds.
  // n: { t, m (midi), v (0..1), pan (-1..1), bend, vib, ring }
  function pluck(n) {
    const [L, Rt] = music;
    const f0 = hz(n.m), v = n.v, ring = n.ring ?? 7;
    const tau = 1.6 * (220 / f0) ** 0.45;                       // low strings ring longer
    const len = Math.min(Math.ceil(Math.min(ring, tau * 6.5) * SR), L.length - Math.floor(n.t * SR));
    if (len <= 0) return;
    const s0 = Math.floor(n.t * SR), gl = Math.cos((n.pan + 1) * Math.PI / 4), gr = Math.sin((n.pan + 1) * Math.PI / 4);
    const parts = [];
    for (let k = 1; k * f0 < 11000 && k <= 24; k++) {
      const a = v * Math.abs(Math.sin(k * Math.PI * 0.13)) / k ** 0.85;   // plucked near the bridge
      parts.push({ f: k * f0 * Math.sqrt(1 + 3e-4 * k * k), a, d: 1 / (tau / (1 + 0.45 * (k - 1))), ph: rnd() * 6.283 });
    }
    const [bt = 0, bc = 0, bg = 0.18] = n.bend || [], vib = n.vib ?? 0;
    const buf = new Float32Array(len);
    let lp = 0;
    for (let s = 0; s < len; s++) {
      const t = s / SR;
      const cents = bc * smooth((t - bt) / bg) + vib * smooth((t - 0.25) / 0.4) * Math.sin(2 * Math.PI * 5.2 * t);
      const r = 2 ** (cents / 1200), atk = Math.min(1, t / 0.003);
      let y = 0;
      for (const p of parts) {
        p.ph += 2 * Math.PI * p.f * r / SR;
        y += p.a * Math.exp(-p.d * t) * Math.sin(p.ph);
      }
      // fingernail click: a short burst of low-passed noise
      if (t < 0.02) { lp += 0.35 * (rnd() * 2 - 1 - lp); y += 0.25 * v * lp * (1 - t / 0.02); }
      // two-stage body: bright attack settling into a softer tail
      buf[s] = y * atk * (0.7 + 0.3 * Math.exp(-t / 0.08));
    }
    const fadeN = Math.min(len, SR * 0.05);
    for (let s = 0; s < len; s++) {
      const g = s > len - fadeN ? (len - s) / fadeN : 1;
      L[s0 + s] += buf[s] * gl * g; Rt[s0 + s] += buf[s] * gr * g;
    }
  }
  return { partials, mbox, noise, glide, pluck };
}

// Freeverb: 8 combs + 4 allpasses; spread (0 / 23) decorrelates left and right. Returns the wet signal only.
export function freeverb(inp, spread, { sr: SR = 48000, room = 0.84, damp = 0.4, pre: preS = 0.02 } = {}) {
  const k = SR / 44100, pre = Math.round(preS * SR), out = new Float32Array(inp.length);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ b: new Float32Array(Math.round((d + spread) * k)), i: 0, st: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ b: new Float32Array(Math.round((d + spread) * k)), i: 0 }));
  for (let s = 0; s < inp.length; s++) {
    const x = (s >= pre ? inp[s - pre] : 0) * 0.015;
    let y = 0;
    for (const c of combs) { const o = c.b[c.i]; c.st = o * (1 - damp) + c.st * damp; c.b[c.i] = x + c.st * room; c.i = (c.i + 1) % c.b.length; y += o; }
    for (const a of aps) { const o = a.b[a.i]; a.b[a.i] = y + o * 0.5; a.i = (a.i + 1) % a.b.length; y = o - y; }
    out[s] = y;
  }
  return out;
}

// 2-pole high-pass (Q 0.707), in place.
export function hpf(a, fc, SR = 48000) {
  const w = 2 * Math.PI * fc / SR, al = Math.sin(w) / (2 * 0.707), a0 = 1 + al, cw = Math.cos(w);
  const b0 = (1 + cw) / 2 / a0, b1 = -(1 + cw) / a0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; a[i] = y; }
  return a;
}

// RMS / peak of a bus in dB (balance checks).
export function level(a, g = 1) {
  let q = 0, pk = 0; for (const v of a) { q += v * v; pk = Math.max(pk, Math.abs(v)); }
  return { rms: 10 * Math.log10(q * g * g / a.length), peak: 20 * Math.log10(pk * g) };
}

// 16-bit stereo WAV, peak-normalized to peakDb dBFS. Creates the folder.
export async function writeWav(file, L, R, SR = 48000, peakDb = -1) {
  const fs = await import('node:fs'), path = await import('node:path');
  let peak = 0; for (let s = 0; s < L.length; s++) peak = Math.max(peak, Math.abs(L[s]), Math.abs(R[s]));
  const g = 10 ** (peakDb / 20) / peak, n = L.length, data = Buffer.alloc(n * 4);
  for (let s = 0; s < n; s++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[s] * g)) * 32767), s * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[s] * g)) * 32767), s * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
