// Kit runtime: clip loading, font readiness, glyph check and the live preview loop.
// A film's engine.html defines window.renderAt(t) and then calls Kit.boot({...}); see _kit/README.md.
//
// Contract with the kit's node tools (render / preview / cues / sheet):
//   window.CLIP        the loaded clip object (also exposed under its film global, e.g. window.SCENE)
//   window.duration    seconds: DURATION(CLIP) if timeline.js defines it, else TIMELINE(CLIP).fade[1]
//   window.renderAt(t) draws frame t deterministically (defined by the film)
//   window.clipHan()   the distinct Han characters the clip may draw (for --check)
//   window.glyphCheck(chars) → the chars the loaded CJK font does not cover
//   window.sceneReady  true once the clip, its helpers and the fonts are loaded
(() => {
  const Kit = (window.Kit = window.Kit || { styles: {} });

  // A character is covered if a *loaded* face of `family` (at each weight) has a unicode-range containing it.
  // Google Fonts subsets only list code points the font has.
  Kit.glyphCheck = (chars, family = 'LXGW WenKai TC', weights = ['400', '700']) => {
    const faces = [...document.fonts].filter((f) => f.family.replace(/"/g, '') === family && f.status === 'loaded');
    const ranges = (f) => f.unicodeRange.split(',').map((r) => {
      const [a, b] = r.trim().replace('U+', '').split('-').map((h) => parseInt(h, 16));
      return [a, b ?? a];
    });
    const covered = (c, w) => faces.filter((f) => String(f.weight) === w)
      .some((f) => ranges(f).some(([a, b]) => c.codePointAt(0) >= a && c.codePointAt(0) <= b));
    return chars.filter((c) => weights.some((w) => !covered(c, w)));
  };

  // opts: { dir: 'scenes', global: 'SCENE', param: 'scene', fallback: 'test-paper',
  //         zhText(A) → Han text to load + check, fonts(A, zh) → [[cssFont, text], …],
  //         cjkFamily?, cjkWeights? }
  // The clip id comes from ?clip= (kit tools) or ?<param>= (old links), else opts.fallback.
  Kit.boot = async (opts) => {
    const q = new URLSearchParams(location.search);
    const name = q.get('clip') || q.get(opts.param) || opts.fallback;
    const load = (f) => new Promise((ok, fail) => {
      const s = document.createElement('script'); s.src = `${opts.dir}/${f}.js`; s.onload = ok;
      s.onerror = () => fail(new Error(`cannot load ${opts.dir}/${f}.js`)); document.head.appendChild(s);
    });
    await load(name);
    const A = window[opts.global];
    for (const u of A.uses || []) await load(u);
    window.CLIP = A;
    const zh = opts.zhText(A);
    window.clipHan = () => [...new Set(zh)].filter((c) => /\p{Script=Han}/u.test(c));
    window.glyphCheck = (chars) => Kit.glyphCheck(chars, opts.cjkFamily, opts.cjkWeights);
    await Promise.all(opts.fonts(A, zh).map(([font, text]) => document.fonts.load(font, text)));
    await document.fonts.ready;
    window.duration = window.DURATION ? window.DURATION(A) : window.TIMELINE(A).fade[1];
    window.sceneReady = true;
    if (!q.has('record')) {
      const t0 = performance.now();
      (function tick() { window.renderAt(((performance.now() - t0) / 1000) % window.duration); requestAnimationFrame(tick); })();
    }
  };
})();
