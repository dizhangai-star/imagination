// look — dev clip (not in the film): three style frames of the world. t∈[0,1) opening, [1,2) drawback, [2,3) ridge.
window.CLIP = {
  id: 'look',
  duration: 3,
  timing: { fadeIn: [-2, -1], fade: [9, 10] },
  uses: ['_ocean', '_world'],
  vignette: 0.45, grain: 0.05,
  glyphs: '梦中时间天体质量行星距离地球木星最近时的所见倍视直径潮高',
  setup(E) { this.w = WORLD.build(E, { sunAz: 20 }); },
  draw(t, E) {
    const { cam, THREE } = E, W = WORLD, w = this.w, shot = Math.floor(t);
    const set = (fov, pos, look) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(...pos); cam.lookAt(...look); };
    if (shot === 0) {
      const p = W.physics(W.distAt(1));
      W.placeBody(w, p.ang, 0.12, -0.25 * p.ang);
      W.update(E, w, { t: 3 + t, level: 0 });
      set(34, [0, 2.05, 12], [0, 0.4, -60]);
    } else if (shot === 1) {
      const p = W.physics(W.distAt(11));
      W.placeBody(w, p.ang, 0.0, 0.28 * p.ang);
      W.update(E, w, { t: 20 + t, level: -2.2, wet: 2.4, surge: 0.05 });
      set(11, [0, 1.7, 12], [0, 0.6, -600]);
    } else {
      const p = W.physics(W.distAt(22));
      W.placeBody(w, p.ang, 0.0, 0.22 * p.ang);
      W.update(E, w, { t: 40 + t, level: -3.5, wet: 3.6, surge: 0.03, ridgeZ: -9000, ridgeH: 170, ridgeW: 700, foam: 0.6 });
      set(10, [0, 1.2, 14], [0, 1.2 + 1000 * 0.022, -1000]);
    }
  },
  overlay(t, E) { WORLD.grade(E); WORLD.readout(E, [1, 11, 22][Math.floor(t)], 1); },
};
