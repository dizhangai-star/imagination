// 01 · Shore — POV walking the wet sand along the waterline at dusk, 35 mm. Starts looking down at a line of
// footprints running ahead (our own, from every other night of the dream), the walk slows, the head lifts and
// turns to the sea: a pale arc on the horizon, too big. Film time 0–7 s.
const PLANET_AZ = -0.3;                                   // opposite the sun (az +20° behind us) → lit full
const WALK_Z = 3.4;                                        // walking line on the wet sand (m inland of the still waterline)
window.CLIP = {
  id: '01-shore',
  duration: 7,
  uses: ['_ocean', '_world'],
  vignette: 0.45, grain: 0.05,
  caps: [[1.0, 4.0, 'I keep having the same dream', '我总是做同一个梦']],
  glyphs: '梦中时间天体质量行星距离地球木星最近时的所见倍视直径潮高',
  // sound draft for Sprint 4 (not read by music.mjs yet): footsteps, surf, the low tone at the arc
  sfxDraft: [[0.3, 'step'], [0.88, 'step'], [1.46, 'step'], [2.04, 'step'], [2.64, 'step'], [3.28, 'step'], [4.0, 'step'], [4.9, 'step', { v: 0.6 }], [3.6, 'tone']],
  // walker position along the shore (x, m): 1.3 m/s, slowing to a stop between 3.2 and 6 s
  walkX(t) { const v = 1.3, a = 3.2, b = 6.0, u = Math.min(Math.max(t - a, 0), b - a); return 4 - v * Math.min(t, a) - v * (u - u * u / (2 * (b - a))); },
  setup(E) {
    // footprints ahead along the walking line, heading −x, alternating feet, stride 0.74 m; a few stray/softened ones
    const R = E.R(11), prints = [];
    for (let i = 0; i < 24; i++) {
      const side = i % 2 ? 1 : -1, x = -1.0 - i * 0.74 + (R() - 0.5) * 0.06;
      prints.push([x, WALK_Z + side * 0.11 + (R() - 0.5) * 0.03, Math.PI + side * 0.12 + (R() - 0.5) * 0.08, side]);
    }
    this.w = WORLD.build(E, { sunAz: 20, prints });
  },
  draw(t, E) {
    const { cam, lerp, eInOut, seg } = E, W = WORLD, w = this.w;
    const p = W.physics(W.distAt(t));
    W.placeBody(w, p.ang, PLANET_AZ, lerp(-0.3, -0.18, t / 7) * p.ang);
    W.update(E, w, { t: 3 + t, level: 0, surge: 0.07, wet: 0.4 });
    // walk: speed → bob (vertical at step rate, sway at half), slight forward-lean pitch bob
    const x = this.walkX(t), sp = t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 2.8), ph = 2 * Math.PI * 1.72 * t;
    const bob = 0.028 * sp * Math.abs(Math.sin(ph / 2)) - 0.014 * sp, sway = 0.018 * sp * Math.sin(ph / 2);
    cam.fov = lerp(34, 29, eInOut(seg(t, 4.0, 7))); cam.updateProjectionMatrix();          // a slow lean-in as it registers
    cam.position.set(x, W.SLOPE * WALK_Z + 1.64 + bob, WALK_Z + sway);
    // head: looking down the path of footprints, lifting and turning to the sea
    const k = eInOut(seg(t, 0.8, 4.6)), yaw = lerp(-1.35, -0.36, eInOut(seg(t, 0.6, 5.4)));
    const pitch = lerp(-0.23, -0.012, k) + 0.004 * sp * Math.sin(ph);
    cam.rotation.set(0, 0, 0); cam.rotation.order = 'YXZ';
    cam.rotation.y = -yaw; cam.rotation.x = pitch; cam.rotation.z = 0.004 * sp * Math.sin(ph / 2);
  },
  overlay(t, E) { WORLD.grade(E); WORLD.readout(E, t, E.alphaIn(t, 4.0, 99, 0.8)); },
};
