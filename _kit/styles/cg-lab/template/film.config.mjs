// Kit config for this film (see {{KIT}}/README.md). Style: cg-lab (three.js, {{KIT}}/styles/cg-lab/STYLE.md).
export default {
  title: '{{TITLE}}',
  style: 'cg-lab',
  clipDir: 'clips', global: 'CLIP', param: 'clip', fallback: '00-title',
  film: 'out/{{NAME}}.mp4',
  fps: 30,
  blackGround: true,   // fades go to black: check.mjs reports black segments without failing
  soundtrack: 'film',   // one film-long score (audio/music.mjs → audio/build/film.wav)
  // .srt export: every caption of every clip
  subtitles: (A) => (A.caps || []).map(([a, b, en, zh]) => [a, b, `${en}\n${zh}`]),
  narration: null,
};
