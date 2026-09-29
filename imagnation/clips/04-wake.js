// 04 · Wake — the same shore and framing where 01 ended, still. Calm swash, an ordinary Moon at its real size
// (0.52°) where the planet rose. Title + the real numbers of the dream. Film time 24–30 s.
const PLANET_AZ = -0.3, WALK_Z = 3.4;
window.CLIP = {
  id: '04-wake',
  duration: 6,
  timing: { fadeIn: [0, 1.4] },                           // out of the black slowly: waking
  uses: ['_ocean', '_world'],
  vignette: 0.45, grain: 0.05,
  glyphs: '巨物木星质量行星距离地球离最近时的潮高一千米洛希极限梦中数秒真实需要天',
  // sound (audio/music.mjs): the first sound after the silence is one soft wave (J-cut under the black), a held note
  sfx: [[-0.4, 'wave', { v: 0.7 }], [1.2, 'note', { d: 4.6 }]],
  setup(E) { this.w = WORLD.build(E, { sunAz: 20, kind: 'moon' }); },
  draw(t, E) {
    const { cam } = E, W = WORLD, w = this.w;
    const m = W.physics(384400, 7.342e22, 1737);
    W.placeBody(w, m.ang, PLANET_AZ, 3.2 * m.ang);
    W.update(E, w, { t: 60 + t, level: 0, surge: 0.07, wet: 0.4, bright: 1.25 });
    // 01's last frame: stopped at x −1.98, head turned to the sea (yaw −0.36), 29° lens
    cam.fov = 29; cam.updateProjectionMatrix();
    cam.position.set(-1.98, W.SLOPE * WALK_Z + 1.64, WALK_Z);
    cam.rotation.order = 'YXZ'; cam.rotation.set(-0.012, 0.36, 0);
  },
  overlay(t, E) {
    WORLD.grade(E);
    const a = E.alphaIn(t, 1.4, 5.35, 0.7), b = E.alphaIn(t, 2.2, 5.35, 0.8);
    E.text('MEGALOPHOBIA', 320, 84, `600 22px ${E.EN}`, '#e9e2d0', a, 'center', 9);
    E.text('巨 物 恐 惧 症', 320, 106, `400 11px ${E.ZH}`, '#d8d0bf', a, 'center', 4);
    const p = WORLD.physics(WORLD.distAt(24)), jd = Math.round(p.jd);          // the peak of 03, from the same physics
    const font = `400 6px "JetBrains Mono", "Noto Serif SC", monospace`, dim = '#b9b2a2';
    E.text(`木星质量  ·  地球离木星最近时的 1/${jd}  ·  潮高 一千米  ·  洛希极限 106,000 km`, 320, 124, font, dim, b, 'center', 1);
    E.text(`JUPITER MASS · 1/${jd} OF JUPITER’S CLOSEST DISTANCE · 1 KM TIDE · ROCHE LIMIT 106,000 KM`, 320, 133, font, '#8a8f96', b * 0.9, 'center', 1);
  },
};
