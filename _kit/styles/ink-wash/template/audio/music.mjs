// Guzheng-style underscore per clip, synthesized (from chinese-zodiac): plucked strings with bends (按音) and
// vibrato (揉弦), a sweep up the strings (刮奏) under the title, a sparse low bed under the narration, and a
// firm low octave at the seal; Freeverb hall. D gong pentatonic. Deterministic (seeded from the clip id).
// Usage: node audio/music.mjs <clip-id> [--secs 12] → audio/build/<id>-music.wav. mix.mjs calls it.
// CLIP.music = { seed, transpose, score(T, P) } overrides the default score for one clip.
import { loadClip, rel, argv } from '{{KIT}}/lib/film.mjs';
import { rng, voices, freeverb, writeWav } from '{{KIT}}/audio/dsp.mjs';

const SR = 48000, A0 = argv(), [id] = A0.positional();
if (!id) { console.error('usage: node audio/music.mjs <clip-id> [--secs S]'); process.exit(1); }
const A = loadClip(id), M = A.music || {}, secs = +A0.opt('secs', A.duration);
const { rnd, jit } = rng(M.seed ?? [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
// D gong pentatonic, D3 upward: P(0)=D3 P(5)=D4 P(10)=D5. Negative degrees reach below D3.
const PENT = [0, 2, 4, 7, 9];
const P = (k) => 50 + (M.transpose || 0) + 12 * Math.floor(k / 5) + PENT[((k % 5) + 5) % 5];
const L = new Float32Array(Math.ceil(secs * SR)), Rt = new Float32Array(L.length);
const { pluck } = voices({ sr: SR, n: L.length, rnd, music: [L, Rt] });

function defaultScore(T) {
  const N = [], add = (t, k, v, o = {}) => N.push({ t, m: P(k), v, pan: o.pan ?? 0, ...o });
  const t0 = T.title[0];
  add(t0 - 0.15, -5, 0.5, { pan: -0.2, ring: 9 });                                                  // low D
  for (let k = 3, t = t0 - 0.1; k <= 13; k++, t += 0.085 - (k - 3) * 0.002) add(t, k, 0.18 + 0.03 * (k - 3), { pan: -0.5 + k * 0.08 });   // 刮奏
  add(t0 + 0.85, 0, 0.55, { pan: -0.15 }); add(t0 + 0.9, 13, 0.4, { pan: 0.45, vib: 18 });
  const s = T.sub[0];                                                                              // bed under the voice
  [[0.1, 5, 0.3], [0.9, 3, 0.24], [1.8, 4, 0.24], [2.7, 5, 0.26], [3.7, 2, 0.22, { bend: [0.3, 200, 0.3] }], [4.6, 3, 0.24], [5.4, 0, 0.3, { ring: 8 }]]
    .forEach(([dt, k, v, o]) => add(s + dt, k, v, { pan: jit(0.35), vib: 10, ...o }));
  const e = T.seal;                                                                                // seal: low octave + fifth
  add(e, -5, 0.6, { pan: -0.25, ring: 9 }); add(e + 0.02, 0, 0.5, { pan: -0.1 }); add(e + 0.04, 3, 0.4, { pan: 0.05 });
  add(e + 0.35, 10, 0.42, { pan: 0.35, vib: 22 });
  return N;
}
const score = (M.score || defaultScore)(A.timing, P);
for (const n of score) { n.t = Math.max(0, n.t + jit(0.012)); n.v *= 1 + jit(0.08); if (n.t < secs) pluck(n); }

const hall = { sr: SR, room: 0.86, damp: 0.35, pre: 0.025 };
const mono = L.map((v, s) => (v + Rt[s]) * 0.5), wl = freeverb(mono, 0, hall), wr = freeverb(mono, 23, hall);
for (let s = 0; s < L.length; s++) { L[s] = L[s] * 0.8 + wl[s] * 0.9; Rt[s] = Rt[s] * 0.8 + wr[s] * 0.9; }
await writeWav(rel(`audio/build/${id}-music.wav`), L, Rt, SR);
console.log(`${id}: ${score.length} notes, ${secs}s → audio/build/${id}-music.wav`);
