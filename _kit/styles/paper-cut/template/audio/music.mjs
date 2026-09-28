// The film's soundtrack, synthesized: a music-box waltz that runs unbroken across every cut, plus paper
// foley on the picture's cues (rise → tap, pop → pop, hang → tick, confetti → sparkle) and each clip's
// CLIP.sfx accents. Starter score (from baby-leyi): replace THEME / the tempo map with the film's own.
// Usage: node audio/music.mjs → audio/build/film.wav (48 kHz stereo, peak −1 dBFS). mix.mjs calls it.
// Balance check: BUS=1 node audio/music.mjs
import { film, rel } from '{{KIT}}/lib/film.mjs';
import cues from '{{KIT}}/audio/cues.mjs';
import { rng, voices, freeverb, hpf, level, writeWav, hz } from '{{KIT}}/audio/dsp.mjs';
import { foley, AUTO } from '{{KIT}}/audio/sfx.mjs';

const SR = 48000, F = film(), END = F.duration, N = Math.ceil(END * SR);
const L = new Float32Array(N), R = new Float32Array(N);          // dry music
const SL = new Float32Array(N), SRt = new Float32Array(N);       // dry SFX
const { rnd, jit } = rng(20260101);
const V = voices({ sr: SR, n: N, rnd, music: [L, R], sfx: [SL, SRt] });
const { partials, mbox } = V;

// ---- score: C-major scale steps (0 = do), in KEY (2 = D major); 3/4 at SPB s per beat ----
const KEY = 2, SPB = 0.62, T0 = 0.35;
const STEP = [0, 2, 4, 5, 7, 9, 11];
const mid = (k, base) => base + KEY + 12 * Math.floor(k / 7) + STEP[((k % 7) + 7) % 7];
const CH = { I: 0, ii: 1, IV: 3, V: 4, vi: 5 };
// 8 bars of [chord, [[beat, step, beats], …]] — an original placeholder theme
const THEME = [
  ['I', [[0, 2, 1], [1, 4, 1], [2, 7, 1]]], ['V', [[0, 6, 2], [2, 4, 1]]], ['vi', [[0, 5, 1], [1, 7, 1], [2, 5, 1]]], ['IV', [[0, 4, 3]]],
  ['I', [[0, 2, 1], [1, 4, 1], [2, 7, 1]]], ['IV', [[0, 8, 2], [2, 7, 1]]], ['V', [[0, 6, 1], [1, 5, 1], [2, 6, 1]]], ['I', [[0, 7, 3]]],
];
const bars = Math.max(1, Math.floor((END - T0 - 3) / (3 * SPB)));
let notes = 0;
for (let bi = 0; bi < bars; bi++) {
  const [c, mel] = THEME[bi % THEME.length], pass = Math.floor(bi / THEME.length), root = CH[c];
  const at = (b) => T0 + (bi * 3 + b) * SPB + jit(0.008), v = (x) => x * (1 + jit(0.07));
  const tri = [root, root + 2, root + 4];
  mbox(at(0), mid(root - 7, 60), v(0.15), -0.35);
  [[1, tri[1]], [2, tri[2]]].forEach(([b, k]) => mbox(at(b), mid(k, 60), v(0.15), -0.15 + 0.1 * b));
  for (const [b, k] of mel) { mbox(at(b), mid(k, pass % 2 ? 84 : 72), v(0.4), 0.15 + jit(0.1)); notes++; }
  notes += 3;
}
mbox(T0 + bars * 3 * SPB, mid(0, 72), 0.35, 0); mbox(T0 + bars * 3 * SPB + 0.01, mid(-7, 60), 0.2, -0.3);   // last chord

// ---- SFX: generic paper foley + pitched kinds in the music's key ----
const pent = (i) => mid([0, 1, 2, 4, 5][((i % 5) + 5) % 5] + 7 * Math.floor(i / 5), 72);
const SFX = {
  ...foley(V, { rnd, jit, sfx: [SL, SRt] }),
  tick: (t, v) => mbox(t, pent(8 + Math.floor(rnd() * 6)), 0.11 * v, jit(0.6), [SL, SRt]),
  sparkle: (t, v) => { for (let i = 0; i < 7; i++) mbox(t + i * 0.07 + jit(0.01), pent(8 + i + Math.floor(rnd() * 2)), 0.1 * v * (1 - i * 0.06), -0.6 + i * 0.2, [SL, SRt]); },
  confetti: (t, v) => SFX.sparkle(t, v * 0.9),
  chime: (t, v) => {
    [0, 2, 4, 7, 9, 11, 14].forEach((k, i) => mbox(t + i * 0.055, mid(k, 72), 0.22 * v, -0.5 + i * 0.16, [SL, SRt]));
    const f = hz(mid(14, 72)); partials(t, [[f, 0.16 * v, 2.6], [f * 2.76, 0.06 * v, 0.9], [f * 5.4, 0.03 * v, 0.3]], 0.2, 6, [SL, SRt]);
  },
};
const TRIM = { chime: 0.6, tick: 0.45, pop: 0.67, confetti: 0.8, sparkle: 0.8, boing: 0.6, tap: 0.8, clap: 3.4, squish: 2.8, sizzle: 2.4, click: 1.4 };
let sfxN = 0;
for (const s of F.clips) {
  const fadeEnd = s.duration - 0.45;
  const ev = [...(cues[s.id]?.cues ?? []).filter(([t]) => t < fadeEnd).map(([t, k, n]) => [t, AUTO[k], n, {}]),
    ...(s.A.sfx ?? []).map(([t, k, o = {}]) => [t, k, 1, o])];
  for (const [t, kind, n, o] of ev) {
    if (!SFX[kind]) throw new Error(`${s.id}: unknown sfx ${kind}`);
    SFX[kind](s.start + t, (o.v ?? 1) * (TRIM[kind] ?? 1), n, o); sfxN++;
  }
}

// ---- room: high-passed send into Freeverb, music wetter than SFX ----
const MUS = 0.8, FX = 0.9, WET = 0.75;
[L, R].forEach((a) => hpf(a, 110, SR));
if (process.env.BUS) { const st = (a, g) => { const l = level(a, g); return `rms ${l.rms.toFixed(1)} dB, peak ${l.peak.toFixed(1)} dB`; }; console.log(`music ${st(L, MUS)} | sfx ${st(SL, FX)}`); }
const send = L.map((v, s) => (v + R[s]) * 0.5 * MUS + (SL[s] + SRt[s]) * 0.5 * FX * 0.45);
hpf(send, 220, SR);
const room = { sr: SR, room: 0.84, damp: 0.4, pre: 0.02 };
const wl = freeverb(send, 0, room), wr = freeverb(send, 23, room);
for (let s = 0; s < N; s++) { L[s] = L[s] * MUS + SL[s] * FX + wl[s] * WET; R[s] = R[s] * MUS + SRt[s] * FX + wr[s] * WET; }
await writeWav(rel('audio/build/film.wav'), L, R, SR);
console.log(`film: ${bars} bars, ${notes} notes, ${sfxN} sfx, ${END}s → audio/build/film.wav`);
