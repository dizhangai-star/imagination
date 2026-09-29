// 02 · Rise — tripod on the shore, 85 mm with a slow push (fov narrows). The planet is half-risen, lit full by
// the sun behind us; the sea draws back across the sand toward it, the exposed flat left glassy and wet.
// Film time 7–15 s.
const T0 = 7, PLANET_AZ = -0.3, LEVEL = -3;                // film-time offset; still-water level at the end (m)
window.CLIP = {
  id: '02-rise',
  duration: 8,
  uses: ['_ocean', '_world'],
  vignette: 0.45, grain: 0.05,
  caps: [[1.6, 6.4, "The sea isn't leaving. It's being pulled.", '海不是在退去，是被拉走']],
  glyphs: '梦中时间天体质量行星距离地球木星最近时的所见倍视直径潮高',
  // sound (audio/music.mjs): surf fades out, drain hiss as the water retreats, sub drone
  sfx: [[-1.0, 'drone', { d: 10.5 }], [1.0, 'drain', { d: 3.4 }], [4.0, 'hush']],
  level(t) { return LEVEL * this.E.eInOut(this.E.seg(t, 0.4, 7.6)); },
  setup(E) { this.E = E; this.w = WORLD.build(E, { sunAz: 20 }); },
  draw(t, E) {
    const { cam, lerp, eInOut, seg } = E, W = WORLD, w = this.w;
    const p = W.physics(W.distAt(T0 + t)), L = this.level(t), k = seg(t, 0, 8);
    W.placeBody(w, p.ang, PLANET_AZ, lerp(-0.12, 0.3, eInOut(k)) * p.ang);
    // as the sea drains: swash calms, the run-up line stays where the sea used to be (everything below it wet)
    W.update(E, w, { t: 20 + t, level: L, wet: 0.14 - L, surge: lerp(0.07, 0.025, k), foam: lerp(1, 0.75, k) });
    cam.fov = lerp(16, 11, eInOut(k)); cam.updateProjectionMatrix();
    cam.position.set(0, W.SLOPE * 12 + 1.62, 12);
    const pitch = THREE_deg(lerp(-0.3, 0.25, eInOut(k))), D = 1000;
    cam.lookAt(Math.sin(PLANET_AZ) * D, cam.position.y + Math.tan(pitch) * D, -Math.cos(PLANET_AZ) * D);
  },
  overlay(t, E) { WORLD.grade(E); WORLD.readout(E, T0 + t, 1); },
};
function THREE_deg(d) { return d * Math.PI / 180; }
