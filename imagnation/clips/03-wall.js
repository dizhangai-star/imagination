// 03 · Wall — 135 mm, low on the drained flat. The planet overfills the frame; under it the horizon lifts into a
// ridge of water and comes on, spray streaming off its crest. Shake from 5 s; hard cut to black at 8.3 s.
// Film time 15–24 s.
const T0 = 15, PLANET_AZ = -0.3;
window.CLIP = {
  id: '03-wall',
  duration: 9,
  timing: { fade: [8.26, 8.3] },                          // a cut to black, held to the end of the clip
  uses: ['_ocean', '_world'],
  vignette: 0.5, grain: 0.05,
  caps: [[2.2, 5.4, 'Tidal bulge: one kilometre', '潮汐隆起 一千米']],
  glyphs: '梦中时间天体质量行星距离地球木星最近时的所见倍视直径潮高',
  // sound (audio/music.mjs): braam as the horizon lifts, rising roar + rumble, hard silence at 7.6
  sfx: [[2.0, 'braam'], [2.0, 'roar', { d: 5.6 }], [5.0, 'rumble', { d: 2.6 }], [7.6, 'silence']],
  level(t) { return -3 - 0.6 * this.E.eInOut(this.E.seg(t, 0, 8.3)); },
  // the ridge: born on the horizon under the planet, growing and accelerating toward us
  ridge(t) {
    const { seg, eInOut } = this.E, k = seg(t, 1.6, 8.3);
    const H = 620 * eInOut(Math.min(1, k * 1.05)), z = -16000 + 11000 * Math.pow(k, 3.2);   // crest: horizon → mid-frame 5.5 s → past the top 7.5 s
    return { ridgeZ: z, ridgeH: H, ridgeW: 250 + 2.6 * H };
  },
  // camera shake: pure function of t (sum of sines, seeded phases), ramping in from 5 s
  shake(t) {
    const a = this.E.eInOut(this.E.seg(t, 5.0, 8.3)), P = this.ph;
    const s = (i, f) => Math.sin(2 * Math.PI * f * t + P[i]);
    return { yaw: a * 0.0011 * (s(0, 5.3) + 0.6 * s(1, 11.7)), pitch: a * 0.0014 * (s(2, 6.1) + 0.5 * s(3, 13.9) + 0.4 * s(4, 2.3)), roll: a * 0.002 * s(5, 3.7) };
  },
  setup(E) {
    this.E = E; const R = E.R(3); this.ph = Array.from({ length: 6 }, () => R() * 6.283);
    this.w = WORLD.build(E, { sunAz: 20 });
  },
  draw(t, E) {
    const { cam, lerp, eInOut, seg } = E, W = WORLD, w = this.w;
    const p = W.physics(W.distAt(T0 + t)), L = this.level(t), r = this.ridge(t);
    W.placeBody(w, p.ang, PLANET_AZ, lerp(0.32, 0.42, seg(t, 0, 9)) * p.ang);
    W.update(E, w, Object.assign({ t: 40 + t, level: L, wet: 0.14 - L, surge: 0.025, foam: 0.7, spray: 0.8 * eInOut(seg(t, 3.5, 6.5)), ridgeSkew: Math.tan(PLANET_AZ) }, r));
    cam.fov = lerp(8.2, 7.4, eInOut(seg(t, 0, 8.3))); cam.updateProjectionMatrix();
    cam.position.set(0, W.SLOPE * 12 + 1.0, 12);
    const sh = this.shake(t), D = 1000, pitch = 0.021 + sh.pitch, yaw = PLANET_AZ + sh.yaw;
    cam.up.set(Math.sin(sh.roll), Math.cos(sh.roll), 0);
    cam.lookAt(Math.sin(yaw) * D, cam.position.y + Math.tan(pitch) * D, -Math.cos(yaw) * D);
  },
  overlay(t, E) { WORLD.grade(E); WORLD.readout(E, T0 + t, 1); },
};
