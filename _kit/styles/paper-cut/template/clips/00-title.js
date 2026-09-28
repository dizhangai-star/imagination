// 00 · Title — a demo of the paper-cut primitives; replace it with the film's opening.
// Hills rise in layers, the sun pops, a cloud hangs on a thread, the title is cut letter by letter, confetti.
window.CLIP = {
  id: '00-title',
  duration: 8,
  captions: { zh: '{{TITLE}}', en: 'A film drawn in code' },
  timing: { cap: [3.4, 6.8] },
  sfx: [[2.6, 'chime']],                       // hand-placed accents; rise/pop/hang/confetti are automatic
  glyphs: '',

  draw(t, E) {
    const { PAL, P, piece, at, strip, rise, pop, hang, sky, paperText, confetti, seg } = E;
    sky(PAL.sky, PAL.dusk);
    const sun = pop(t, 0.9);
    if (sun > 0) at(470, 110, () => piece(P.circle(0, 0, 34), PAL.sun, { z: 1.2 }), { s: sun });
    hang(t, 170, 70, 1.3, (ex, ey, rot) => at(ex, ey, () => piece(P.blob([[-30, 12], [-18, -4], [0, -10], [20, -4], [32, 12]]), PAL.white, { z: 1.4 }), { rot }), { swing: 0.25 });
    // hills, back to front: each layer higher z (longer shadow) and rising a little later
    [[PAL.sage, 250, 3.6, 0.2], [PAL.leaf, 290, 3.0, 0.45], [PAL.moss, 322, 2.4, 0.7]].forEach(([col, y, z, t0], i) => {
      at(0, rise(t, t0, 0.9, 200), () => piece(strip([[-20, y + 12], [120, y - 22 + i * 6], [300, y + 4], [470, y - 26], [660, y + 8]]), col, { z }));
    });
    paperText('{{TITLE}}', 320, 196, { t, t0: 1.8, split: '', size: 34, weight: 900, col: PAL.navy, z: 1.4, stagger: 0.07 });
    confetti(t, 2.6, 320, 180, { n: 26, seed: 3 });
  },
};
