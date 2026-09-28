// Kit config for this film (see ../_kit/README.md). Style: cg-lab (three.js, ../_kit/styles/cg-lab/STYLE.md).
export default {
  title: 'Megalophobia · 巨物',
  style: 'cg-lab',
  clipDir: 'clips', global: 'CLIP', param: 'clip', fallback: '01-shore',
  film: 'out/imagnation.mp4',
  fps: 30,
  samples: 16,         // cg-lab sub-frames per frame for render.mjs (motion blur + AA); previews use 1 unless --samples
  blackGround: true,   // fades go to black: check.mjs reports black segments without failing
  soundtrack: 'film',   // one film-long score (audio/music.mjs → audio/build/film.wav)
  // .srt export: every caption of every clip
  subtitles: (A) => (A.caps || []).map(([a, b, en, zh]) => [a, b, `${en}\n${zh}`]),
  narration: null,
};
