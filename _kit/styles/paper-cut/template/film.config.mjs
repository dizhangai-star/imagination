// Kit config for this film (see {{KIT}}/README.md).
export default {
  title: '{{TITLE}}',
  style: 'paper-cut',
  clipDir: 'clips', global: 'CLIP', param: 'clip', fallback: '00-title',
  film: 'out/{{NAME}}.mp4',
  fps: 30,
  soundtrack: 'film',   // one track across the film (audio/music.mjs), sliced for single clips
  filmFadeOut: 2.4,
  // .srt export (node {{KIT}}/bin/srt.mjs): the hanging caption card, while it is up
  subtitles: (A, T) => (A.captions && A.overlays !== false ? [[T.cap[0], T.cap[1], `${A.captions.zh}\n${A.captions.en}`]] : []),
};
