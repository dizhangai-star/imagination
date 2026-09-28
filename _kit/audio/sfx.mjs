// Procedural foley for paper/diorama films, from baby-leyi. Each kind is fn(t, v, n, o): time (s), level,
// count (merged cues), options. Needs voices() from dsp.mjs and the same rnd/jit stream.
//   const FX = foley(V, { rnd, jit, sfx: [SL, SR2] });   FX.pop(t, 1, 1, {})
// Kinds: pop, tap, click, boing, bip, thump, squish, ding, tram, clink, flick, whoosh ({d}), clap, wood, sizzle ({d}).
// Pitched kinds (tick, sparkle, chime) depend on the film's key, so they live in the film's music.mjs.
// The engine's cue() kinds map to foley through AUTO; SCENE.sfx = [[t, kind, {v, d}]] adds accents by hand.
export const AUTO = { rise: 'tap', pop: 'pop', hang: 'tick', confetti: 'confetti' };

export function foley({ partials, noise, glide }, { rnd, jit, sfx }) {
  const F = {
    pop: (t, v, n) => { const p = 1 + jit(0.15); glide(t, 0.07, 0.3 * v * (1 + 0.15 * Math.min(n - 1, 4)), (u) => (820 - 420 * u) * p, jit(0.4), (u) => (1 - u) ** 2); noise(t, 0.012, 0.12 * v, jit(0.3), undefined, { bp: 3500, q: 0.8 }); },
    tap: (t, v, n) => { glide(t, 0.1, 0.22 * v * Math.min(1.6, 1 + 0.2 * (n - 1)), (u) => 150 - 60 * u, jit(0.3)); noise(t, 0.05, 0.1 * v, jit(0.3), undefined, { bp: 900, q: 0.7 }); },
    click: (t, v) => { noise(t, 0.02, 0.35 * v, 0.2, undefined, { bp: 3200, q: 1.2 }); noise(t + 0.055, 0.03, 0.28 * v, 0.2, undefined, { bp: 2400, q: 1.2 }); glide(t + 0.02, 0.05, 0.05 * v, () => 1800, 0.2); },
    boing: (t, v) => glide(t, 0.42, 0.3 * v, (u) => (170 + 330 * Math.min(1, u * 3)) * (1 + 0.12 * Math.sin(u * 60) * Math.exp(-u * 3)), 0.1, (u) => Math.exp(-u * 4)),
    bip: (t, v) => glide(t, 0.07, 0.12 * v, () => 1320, 0.35, (u) => (u < 0.85 ? 1 : (1 - u) / 0.15)),
    thump: (t, v) => { [0, 0.14].forEach((d, i) => { glide(t + d, 0.14, (i ? 0.4 : 0.55) * v, (u) => 62 - 16 * u, 0, (u) => Math.exp(-u * 5)); noise(t + d, 0.1, 0.1 * v, 0, undefined, { bp: 200, q: 0.8 }); }); },
    squish: (t, v) => { noise(t, 0.35, 0.4 * v, 0, undefined, { sweep: [900, 180], q: 2.5, dec: 0.15 }); glide(t, 0.3, 0.12 * v, (u) => 110 + 30 * Math.sin(u * 30), 0); },
    ding: (t, v) => { const f = 1568; partials(t, [[f, 0.14 * v, 0.8], [f * 2.76, 0.05 * v, 0.25], [f * 5.4, 0.02 * v, 0.08]], 0.2, 2.5, sfx); },
    tram: (t, v) => { F.ding(t, v * 1.3); F.ding(t + 0.26, v * 1.2); },
    clink: (t, v) => { [3150, 4870, 7020].forEach((f, i) => partials(t, [[f * (1 + jit(0.01)), [0.08, 0.05, 0.03][i] * v, 0.35]], 0.25 + jit(0.3), 1.2, sfx)); noise(t, 0.01, 0.1 * v, 0.2, undefined, { bp: 6000 }); },
    flick: (t, v) => noise(t, 0.12, 0.3 * v, 0.1 + jit(0.3), undefined, { sweep: [5500, 1800], q: 0.6, atk: 0.015, shape: (u) => Math.sin(Math.PI * u) ** 2 }),
    whoosh: (t, v, n, o) => noise(t, o.d ?? 1, 0.28 * v, 0, undefined, { sweep: [400, 1600], q: 0.9, atk: 0.2, shape: (u) => Math.sin(Math.PI * u) ** 2 }),
    clap: (t, v) => { [0, 0.008, 0.017].forEach((d) => noise(t + d, 0.05, 0.22 * v, jit(0.4), undefined, { bp: 1300 + jit(200), q: 1, dec: 0.012 })); },
    wood: (t, v) => partials(t, [[880 * (1 + jit(0.02)), 0.3 * v, 0.045], [2090, 0.08 * v, 0.02]], -0.3, 0.3, sfx),
    sizzle: (t, v, n, o) => { const d = o.d ?? 1; for (let k = 0; k < d * 40; k++) noise(t + rnd() * d, 0.012, 0.08 * v * rnd(), jit(0.5), undefined, { bp: 5000 + rnd() * 3000, q: 1.5 }); noise(t, d, 0.05 * v, 0, undefined, { bp: 6500, q: 0.5, shape: (u) => Math.sin(Math.PI * u) }); },
  };
  return F;
}
