// The film's soundtrack, synthesized: a cinematic hybrid starter score (from vfx-creature) — a low drone, a slow
// minor pad progression across every cut, a hit at each clip's start — plus each clip's CLIP.sfx cue sheet
// ([t, kind, {v, d}] in clip seconds). Replace PROG / the hits with the film's own score, timed to the picture.
// Usage: node audio/music.mjs → audio/build/film.wav (48 kHz stereo, peak −1 dBFS). mix.mjs calls it.
// Balance check: BUS=1 node audio/music.mjs
import { film, rel } from '../../_kit/lib/film.mjs';
import { rng, voices, freeverb, hpf, level, writeWav, hz, panG } from '../../_kit/audio/dsp.mjs';
import { foley } from '../../_kit/audio/sfx.mjs';

const SR = 48000, F = film(), END = F.duration, N = Math.ceil(END * SR);
const L = new Float32Array(N), R = new Float32Array(N), MUS = [L, R];           // music
const SL = new Float32Array(N), SRt = new Float32Array(N), SFX = [SL, SRt];     // sound design
const { rnd, jit } = rng(20260101);
const V = voices({ sr: SR, n: N, rnd, music: MUS, sfx: SFX });
const { noise, glide } = V;

// ---------- voices ----------
// State-variable filter (Chamberlin): returns a stepper (x, fc, q) → { lp, bp, hp }; fc capped for stability.
function svf() {
  let lp = 0, bp = 0; const o = { lp: 0, bp: 0, hp: 0 };
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, 7000) / SR);
    lp += f * bp; const hp = x - lp - q * bp; bp += f * hp;
    o.lp = lp; o.bp = bp; o.hp = hp; return o;
  };
}
const blep = (p, dt) => p < dt ? (p /= dt, p + p - p * p - 1) : p > 1 - dt ? (p = (p - 1) / dt, p * p + p + p + 1) : 0;
// Subtractive voice: n detuned PolyBLEP saws (or sines) → low-pass whose cutoff follows the envelope (c0 → c1).
// o: n det(cents) atk rel dec(exp decay s) c0 c1 q vib(cents) bend(u → semitones) wave 'saw'|'sine'
function syn(bus, t, d, m, v, pan, o = {}) {
  const rel = o.rel ?? 0.4, s0 = Math.floor(t * SR), n = Math.min(Math.ceil((d + rel * 3) * SR), N - s0);
  if (n <= 0 || s0 < 0) return;
  const nv = o.n ?? 3, det = o.det ?? 8, f0 = hz(m), sine = o.wave === 'sine';
  const ph = Array.from({ length: nv }, () => rnd()), fr = Array.from({ length: nv }, (_, i) => nv === 1 ? 1 : 2 ** (det * (i / (nv - 1) * 2 - 1) / 1200));
  const [gl, gr] = panG(pan), [bl, br] = bus, atk = Math.max(1, (o.atk ?? 0.05) * SR), dn = d * SR, flt = svf();
  const c0 = o.c0 ?? 400, c1 = o.c1 ?? 2400, q = o.q ?? 0.8, dec = o.dec ? 1 / (o.dec * SR) : 0, vph = rnd() * 6.28;
  for (let i = 0; i < n; i++) {
    const u = i / dn;
    const e = (i < atk ? i / atk : 1) * (i > dn ? Math.exp(-(i - dn) / (rel * SR)) : 1) * (dec ? Math.exp(-i * dec) : 1);
    const cents = (o.vib ?? 0) * Math.min(1, u * 2) * Math.sin(2 * Math.PI * 5 * i / SR + vph) + (o.bend ? o.bend(Math.min(u, 1)) * 100 : 0);
    const r = 2 ** (cents / 1200);
    let x = 0;
    for (let k = 0; k < nv; k++) {
      const dt = f0 * fr[k] * r / SR; ph[k] += dt; if (ph[k] >= 1) ph[k] -= 1;
      x += sine ? Math.sin(2 * Math.PI * ph[k]) : 2 * ph[k] - 1 - blep(ph[k], dt);
    }
    x /= nv;
    const y = sine ? x : flt(x, c0 + (c1 - c0) * e, q).lp;
    bl[s0 + i] += y * e * v * gl; br[s0 + i] += y * e * v * gr;
  }
}
const chord = (bus, t, d, ms, v, o = {}) => ms.forEach((m, i) => syn(bus, t + jit(0.01), d, m, v / Math.sqrt(ms.length), (i / Math.max(1, ms.length - 1) - 0.5) * (o.spread ?? 0.7), o));
const taiko = (bus, t, v, pan = 0) => {
  glide(t, 0.8, 0.9 * v, (u) => 52 + 70 * Math.exp(-u * 16), pan, (u) => Math.exp(-u * 5.5), bus);
  noise(t, 0.14, 0.55 * v, pan, bus, { bp: 170, q: 0.7, dec: 0.035 });
};
const boom = (bus, t, v, len = 2.6) => {
  glide(t, len, v, (u) => 27 + 48 * Math.exp(-u * 6), 0, (u) => Math.exp(-u * 2.4), bus);
  noise(t, 1.4, 0.35 * v, 0, bus, { bp: 90, q: 0.5, dec: 0.4 });
};
const riser = (bus, t, d, v) => noise(t, d, v, 0, bus, { sweep: [250, 7000], q: 1.1, atk: 0.01, shape: (u) => u ** 2.5 * (u < 0.96 ? 1 : (1 - u) / 0.04) });
const hit = (bus, t, v) => { boom(bus, t, v * 1.3); taiko(bus, t, v, -0.1); noise(t, 0.5, 0.25 * v, 0, bus, { bp: 3200, q: 0.4, dec: 0.12 }); };
const PAD = { n: 3, det: 11, atk: 1.4, rel: 1.6, c0: 250, c1: 1300, q: 0.9 };

// ---------- score (D minor): drone, pad progression every 4 s, a soft hit at each clip start ----------
const CH = { Dm: [38, 45, 50, 53, 57], Bb: [34, 41, 46, 50, 53], F: [41, 48, 53, 57, 60], C: [36, 43, 48, 52, 55] };
const PROG = ['Dm', 'Bb', 'F', 'C'];
chord(MUS, 0.3, END - 1.5, [26, 38], 0.35, { ...PAD, atk: 2.5, rel: 1.2, c1: 600 });
let bars = 0;
for (let t = 0.5; t < END - 3; t += 4, bars++) chord(MUS, t, 3.9, CH[PROG[bars % PROG.length]].slice(1), 0.24, PAD);
for (const c of F.clips) if (c.start > 0) hit(MUS, c.start + 0.05, 0.45);

// ---------- sound design: CLIP.sfx cue sheets → foley kinds, plus the style's own ----------
const KINDS = {
  ...foley(V, { rnd, jit, sfx: SFX }),
  boom: (t, v) => boom(SFX, t, 0.8 * v),
  riser: (t, v, n, o) => riser(SFX, t, o.d ?? 1.2, 0.2 * v),
  scan: (t, v, n, o) => { const d = o.d ?? 1.8; noise(t, d, 0.05 * v, 0, SFX, { sweep: [900, 2200], q: 1.6, atk: 0.02, shape: (u) => Math.sin(Math.PI * u) ** 1.2 }); },
};
let sfxN = 0;
for (const c of F.clips) for (const [t, kind, o = {}] of c.A.sfx ?? []) {
  if (!KINDS[kind]) throw new Error(`${c.id}: unknown sfx ${kind}`);
  KINDS[kind](c.start + t, o.v ?? 1, 1, o); sfxN++;
}

// ---------- mix: music + SFX, a hall, the film fades to silence ----------
const GM = 0.9, GS = 1.8, WET = 0.6;
[L, R, SL, SRt].forEach((a) => hpf(a, 28, SR));
if (process.env.BUS) { const st = (a, g) => { const l = level(a, g); return `rms ${l.rms.toFixed(1)} dB, peak ${l.peak.toFixed(1)} dB`; }; console.log(`music ${st(L, GM)} | sfx ${st(SL, GS)}`); }
const send = L.map((v, i) => (v + R[i]) * 0.5 * GM + (SL[i] + SRt[i]) * 0.5 * GS * 0.35);
hpf(send, 180, SR);
const hall = { sr: SR, room: 0.88, damp: 0.45, pre: 0.03 };
const wl = freeverb(send, 0, hall), wr = freeverb(send, 23, hall);
for (let i = 0; i < N; i++) { L[i] = L[i] * GM + SL[i] * GS + wl[i] * WET; R[i] = R[i] * GM + SRt[i] * GS + wr[i] * WET; }
for (let i = Math.floor((END - 0.8) * SR); i < N; i++) { const g = (N - i) / (0.8 * SR); L[i] *= g; R[i] *= g; }
await writeWav(rel('audio/build/film.wav'), L, R, SR);
console.log(`film: ${bars} pad bars, ${sfxN} sfx, ${END}s → audio/build/film.wav`);
