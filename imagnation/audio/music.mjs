// Megalophobia's soundtrack, synthesized (no narration): surf + wind → footsteps → a low tone at the arc → sub drone
// (J-cut under 01's end) → the drain → near-silence → braam, roar, rumble → hard silence at 03 7.6 s → one wave
// under the black (J-cut into 04) → a single held note under the title.
// Cue sheets: each clip's CLIP.sfx ([t, kind, {v, d}] in clip seconds; t < 0 = before the cut). Beds (surf, wind)
// are continuous and follow the picture: the surf hiss tracks the swash function of `_world.js` (`uSurge` sines).
// Usage: node audio/music.mjs → audio/build/film.wav (48 kHz stereo, peak −1 dBFS). mix.mjs calls it.
// Balance check: BUS=1 node audio/music.mjs (music | sfx RMS per 0.5 s)
import { film, rel } from '../../_kit/lib/film.mjs';
import { rng, voices, freeverb, hpf, level, writeWav, hz, panG } from '../../_kit/audio/dsp.mjs';

const SR = 48000, F = film(), END = F.duration, N = Math.ceil(END * SR);
const L = new Float32Array(N), R = new Float32Array(N), MUS = [L, R];           // music
const SL = new Float32Array(N), SRt = new Float32Array(N), SFX = [SL, SRt];     // sound design
const { rnd, jit } = rng(20260929);
const V = voices({ sr: SR, n: N, rnd, music: MUS, sfx: SFX });
const { noise, glide } = V;
const at = (id) => F.clips.find((c) => c.id === id).start;                      // clip start in film seconds
const S = (t) => Math.max(0, Math.min(N, Math.floor(t * SR)));
const c01 = (x) => Math.min(1, Math.max(0, x));
const sm = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

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
    const e = (i < atk ? (o.curve ? (i / atk) ** o.curve : i / atk) : 1) * (i > dn ? Math.exp(-(i - dn) / (rel * SR)) : 1) * (dec ? Math.exp(-i * dec) : 1);
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
// Continuous filtered-noise bed from film t0 to t1: ctl(t) → [gain, cutoff Hz, 'lp'|'bp'|'hp', q], evaluated every
// 64 samples and smoothed. Two decorrelated channels (width 0..1) for a wide stereo bed.
function bed(bus, t0, t1, ctl, width = 0.8) {
  const s0 = S(t0), s1 = S(t1), fl = svf(), fr = svf(), [bl, br] = bus;
  let g = 0, fc = 200, mode = 'lp', q = 0.7;
  for (let i = s0; i < s1; i++) {
    if ((i - s0) % 64 === 0) { const c = ctl(i / SR); g = c[0]; fc = c[1]; mode = c[2] ?? 'lp'; q = c[3] ?? 0.7; }
    const a = rnd() * 2 - 1, b = rnd() * 2 - 1, m = (1 - width) * a;
    bl[i] += fl(a, fc, q)[mode] * g; br[i] += fr(m + width * b, fc, q)[mode] * g;
  }
}
const boom = (bus, t, v, len = 2.6) => {
  glide(t, len, v, (u) => 27 + 48 * Math.exp(-u * 6), 0, (u) => Math.exp(-u * 2.4), bus);
  noise(t, 1.4, 0.35 * v, 0, bus, { bp: 90, q: 0.5, dec: 0.4 });
};

// ---------- the world's water: swash at the shore, as drawn (_world.js SURFACE, at x ≈ 0) ----------
const UT = { '01-shore': 3, '02-rise': 20, '03-wall': 40, '04-wake': 60 };            // each clip's update({t}) offset
const swash = (u) => 0.55 * Math.sin(u * 0.9) + 0.45 * Math.sin(u * 1.37 + 1.7);
const swashD = (u) => 0.55 * 0.9 * Math.cos(u * 0.9) + 0.45 * 1.37 * Math.cos(u * 1.37 + 1.7);
// surf of one clip: a low body that swells with the run-up + a bright hiss while the water runs (either way)
function surf(id, t0, t1, vf) {
  const c0 = at(id), off = UT[id] - c0;
  bed(SFX, t0, t1, (t) => { const u = t + off, s = swash(u); return [vf(t) * 0.16 * (0.55 + 0.45 * s), 260 + 140 * s, 'lp', 0.6]; }, 0.7);
  bed(SFX, t0, t1, (t) => { const u = t + off, r = Math.abs(swashD(u)); return [vf(t) * 0.035 * (0.2 + r ** 1.5), 2600 + 1400 * r, 'bp', 1.4]; }, 0.9);
}
const wind = (t0, t1, vf) => bed(SFX, t0, t1, (t) => [vf(t) * 0.05 * (0.7 + 0.3 * Math.sin(t * 0.43) * Math.sin(t * 0.17 + 1)), 520 + 260 * Math.sin(t * 0.31), 'bp', 0.9], 1);

// ---------- cue kinds (clip sfx) ----------
let foot = 0;
const KINDS = {
  // a bare foot in wet sand: soft heel thud, a wet squelch, a short sand crunch
  step: (t, v) => {
    const pan = (foot++ % 2 ? 0.12 : -0.12);
    glide(t, 0.16, 0.35 * v, (u) => 95 - 45 * u, pan, (u) => Math.exp(-u * 7));
    noise(t + 0.01, 0.14, 0.22 * v, pan, SFX, { sweep: [520, 1100], q: 2.2, atk: 0.006, dec: 0.045 });
    noise(t + 0.03, 0.09, 0.07 * v, pan, SFX, { bp: 3800, q: 0.8, dec: 0.02 });
  },
  // a single low tone as the arc enters frame (D2 + a faint fifth), it keeps humming into 02 (J-cut)
  tone: (t, v, o) => { const d = o.d ?? 4; syn(MUS, t, d, 38, 0.2 * v, -0.1, { n: 2, det: 4, wave: 'sine', atk: 1.8, rel: 1.4 });
    syn(MUS, t + 0.4, d - 0.4, 45, 0.05 * v, 0.2, { n: 2, det: 5, atk: 2.2, rel: 1.4, c0: 180, c1: 520 }); },
  // sub drone: D1 + D2, filter slowly opening; swells under 02 and on into 03
  drone: (t, v, o) => { const d = o.d ?? 8;
    syn(MUS, t, d, 26, 0.3 * v, 0, { n: 2, det: 3, wave: 'sine', atk: 2.5, rel: 1.2, curve: 2 });
    syn(MUS, t + 0.5, d - 0.5, 38, 0.12 * v, 0, { n: 3, det: 9, atk: d * 0.7, rel: 1.2, c0: 120, c1: 480, q: 1.1, curve: 2 }); },
  // the sea drawing back over the sand: fizz of draining grains, thinning out; a low suck under it
  drain: (t, v, o) => {
    const d = o.d ?? 5, n = Math.round(d * 90);
    for (let i = 0; i < n; i++) { const u = rnd(), tt = t + u * d, a = Math.sin(Math.PI * Math.min(1, u * 1.4)) ** 1.5;
      noise(tt, 0.02, 0.05 * v * a * (0.4 + rnd()), jit(0.8), SFX, { bp: 2500 + 4500 * rnd(), q: 2, dec: 0.004 }); }
    noise(t, d, 0.05 * v, 0, SFX, { sweep: [1800, 700], q: 0.7, atk: 0.6, shape: (u) => Math.sin(Math.PI * u) ** 0.8 });
    glide(t + 0.2, d * 0.8, 0.08 * v, (u) => 70 - 25 * u, 0, (u) => Math.sin(Math.PI * u));
  },
  // the braam as the horizon lifts: low brass cluster, filter opening, and a boom under it
  braam: (t, v) => {
    [[26, 0.4], [38, 0.5], [45, 0.32], [50, 0.2]].forEach(([m, g], i) => syn(MUS, t, 3.2, m, 0.6 * g * v, (i - 1.5) * 0.25, { n: 4, det: 14, atk: 0.06, rel: 1.8, dec: 3.5, c0: 140, c1: 1500, q: 1.2 }));
    boom(MUS, t, 0.5 * v, 3.5);
  },
  // the wall's roar: brown noise opening as it comes (clipped at the end by the silence)
  roar: (t, v, o) => { const d = o.d ?? 5.6;
    bed(SFX, t, t + d + 0.5, (x) => { const u = (x - t) / d; return [v * 0.8 * c01(u) ** 2.2, 110 + 1200 * c01(u) ** 2, 'lp', 0.6]; }, 0.6);
    bed(SFX, t + d * 0.4, t + d + 0.5, (x) => { const u = (x - t - d * 0.4) / (d * 0.6); return [v * 0.08 * c01(u) ** 2.5, 900 + 2600 * Math.min(1, u), 'bp', 0.9]; }, 1);
    noise(t + d - 3, 3.3, 0.12 * v, 0, MUS, { sweep: [200, 5000], q: 1.1, atk: 0.01, shape: (u) => u ** 3 });   // riser into the cut
  },
  // ground-borne rumble with the shake: 28–45 Hz, lurching amplitude
  rumble: (t, v, o) => { const d = o.d ?? 2.6;
    bed(SFX, t, t + d + 0.5, (x) => { const u = (x - t) / d; return [v * 0.9 * c01(u) ** 1.5 * (0.7 + 0.3 * Math.sin(x * 23) * Math.sin(x * 7.1)), 45, 'lp', 0.9]; }, 0.3);
  },
  // one soft wave on the shore (starts under the black): a swell of low water, then the wash hissing out
  wave: (t, v) => {
    bed(SFX, t, t + 4.5, (x) => { const u = (x - t) / 4.5; return [v * 0.22 * Math.sin(Math.PI * c01(u * 1.6)) ** 1.5, 220 + 300 * Math.sin(Math.PI * u), 'lp', 0.6]; }, 0.7);
    bed(SFX, t + 0.9, t + 5, (x) => { const u = (x - t - 0.9) / 4.1; return [v * 0.06 * Math.exp(-u * 3) * Math.min(1, u * 8), 3200 - 1400 * u, 'bp', 1.2]; }, 0.9);
  },
  // a single held note under the title: A4, glassy, a slow vibrato, an octave below very faint
  note: (t, v, o) => { const d = o.d ?? 4.6;
    syn(MUS, t, d, 69, 0.07 * v, 0.05, { n: 1, wave: 'sine', atk: 1.4, rel: 1.6, vib: 4 });
    syn(MUS, t + 0.3, d - 0.3, 57, 0.035 * v, -0.1, { n: 3, det: 7, atk: 1.8, rel: 1.6, c0: 300, c1: 900 }); },
  hush: () => {}, silence: () => {},                                          // gain events, applied in the mix below
};
let sfxN = 0;
for (const c of F.clips) for (const [t, kind, o = {}] of c.A.sfx ?? []) {
  if (!KINDS[kind]) throw new Error(`${c.id}: unknown sfx ${kind}`);
  KINDS[kind](c.start + t, o.v ?? 1, o); sfxN++;
}
const cue = (id, kind) => { const c = F.clips.find((x) => x.id === id), e = c.A.sfx.find((x) => x[1] === kind); return c.start + e[0]; };

// ---------- beds: surf + wind in 01, the surf drains away in 02, wind thins; nothing but the wall in 03; 04 calm ----------
const t2 = at('02-rise'), t3 = at('03-wall'), t4 = at('04-wake');
surf('01-shore', 0, t2, (t) => sm(0, 0.8, t));
surf('02-rise', t2, t2 + 5, (t) => 1 - sm(t2, t2 + 4.2, t));
wind(0, t3 + 7, (t) => sm(0, 1, t) * (1 - 0.6 * sm(t2 + 2, t2 + 5, t)));
surf('04-wake', t4 + 2.2, END, (t) => 0.55 * sm(t4 + 2.2, t4 + 4, t));
wind(t4 + 0.5, END, (t) => 0.5 * sm(t4 + 0.5, t4 + 2.5, t));

// ---------- mix: music + SFX, a hall; the hush and the hard silence cut after the reverb ----------
const GM = 0.9, GS = 1.6, WET = 0.45;
[L, R, SL, SRt].forEach((a) => hpf(a, 24, SR));
if (process.env.BUS) {
  const st = (a, g) => { const l = level(a, g); return `rms ${l.rms.toFixed(1)} dB, peak ${l.peak.toFixed(1)} dB`; };
  console.log(`music ${st(L, GM)} | sfx ${st(SL, GS)}`);
  for (let t = 0; t < END; t += 0.5) {
    const a = S(t), b = S(t + 0.5), db = (arr, g) => { let s = 0; for (let i = a; i < b; i++) s += (arr[i] * g) ** 2; return (10 * Math.log10(s / (b - a) + 1e-12)).toFixed(0).padStart(4); };
    console.log(`${t.toFixed(1).padStart(5)}  ${db(L, GM)} | ${db(SL, GS)}`);
  }
}
const send = L.map((v, i) => (v + R[i]) * 0.5 * GM + (SL[i] + SRt[i]) * 0.5 * GS * 0.3);
hpf(send, 160, SR);
const hall = { sr: SR, room: 0.86, damp: 0.5, pre: 0.03 };
const wl = freeverb(send, 0, hall), wr = freeverb(send, 23, hall);
const hush = cue('02-rise', 'hush'), cut = cue('03-wall', 'silence'), wake = cue('04-wake', 'wave');
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const gh = 1 - 0.94 * sm(hush - 0.4, hush + 0.3, t) * (1 - sm(hush + 1.6, hush + 2.4, t));   // near-silence (≈ −24 dB)
  const gc = t >= cut && t < wake ? 0 : 1;                                                 // hard silence, no tail
  L[i] = (L[i] * GM + SL[i] * GS + wl[i] * WET) * gh * gc; R[i] = (R[i] * GM + SRt[i] * GS + wr[i] * WET) * gh * gc;
}
for (let i = Math.floor((END - 1.2) * SR); i < N; i++) { const g = (N - i) / (1.2 * SR); L[i] *= g; R[i] *= g; }
await writeWav(rel('audio/build/film.wav'), L, R, SR);
console.log(`film: ${sfxN} sfx, ${END}s → audio/build/film.wav`);
