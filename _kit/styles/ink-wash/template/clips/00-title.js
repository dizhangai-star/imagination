// 00 · Title — a demo of the ink-wash primitives; replace it with the film's opening.
// Far peaks wash in, a moon, a plum branch is painted stroke by stroke, blossoms dab on, ground mist.
window.CLIP = {
  id: '00-title',
  title: '{{SEAL}}',
  en: '{{TITLE}}',
  narration: { zh: '一筆一畫，墨色慢慢化開。', en: 'Stroke by stroke, the ink slowly blooms.' },

  draw(t, E) {
    const { seg, ez, R, wash, mass, moon, ribbon, brush, blob, ground, taper, SEAL } = E;
    moon(470, 92, 26, ez(seg(t, 0.4, 1.6)));
    mass([[330, 250], [380, 170], [430, 150], [480, 190], [560, 250]], ez(seg(t, 0.2, 2.2)), 0.35, 4, [0.1, 0.4]);
    mass([[440, 260], [500, 205], [560, 190], [620, 240], [640, 262]], ez(seg(t, 0.6, 2.6)), 0.45, 5, [-0.2, 0.4]);
    ground(262, ez(seg(t, 1, 3)), 11, 0.9);
    // plum branch: one ribbon trunk, two twigs, then blossoms (pale ink with a red heart)
    const trunk = [[640, 60], [590, 92], [548, 104], [500, 130], [470, 128]];
    ribbon(trunk, 9, ez(seg(t, 2.4, 4.4)), 0.85, taper.head, 3);
    brush([[552, 104], [540, 80], [520, 70]], 2.6, ez(seg(t, 3.6, 4.6)), 0.7, 5);
    brush([[505, 128], [488, 150], [470, 158]], 2.4, ez(seg(t, 4, 5)), 0.7, 6);
    const r = R(9);
    [[520, 70], [538, 84], [470, 158], [488, 146], [500, 126], [560, 98], [470, 128]].forEach(([bx, by], i) => {
      const p = ez(seg(t, 4.6 + i * 0.18, 5.2 + i * 0.18));
      blob(bx + (r() - 0.5) * 4, by + (r() - 0.5) * 4, 4.2, 3.8, r(), p, 0.28);
      blob(bx, by, 1.2, 1.2, 0, p, 0.9, SEAL);
    });
  },
};
