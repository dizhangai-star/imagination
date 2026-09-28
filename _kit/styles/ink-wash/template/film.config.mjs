// Kit config for this film (see {{KIT}}/README.md).
export default {
  title: '{{TITLE}}',
  style: 'ink-wash',
  clipDir: 'clips', global: 'CLIP', param: 'clip', fallback: '00-title',
  film: 'out/{{NAME}}.mp4',
  fps: 30,
  soundtrack: 'clip',   // each clip: guzheng music (audio/music.mjs) + narration, mixed per clip
  // .srt export (node {{KIT}}/bin/srt.mjs): the narration line, while the subtitle is up
  subtitles: (A, T) => (A.narration ? [[T.sub[0], T.sub[1], `${A.narration.zh}\n${A.narration.en}`]] : []),
  narration: {          // set to null for a film without a voice
    field: 'narration.zh',
    voice: 'zh-TW-HsiaoChenNeural',
    voices: ['zh-TW-HsiaoChenNeural', 'zh-TW-YunJheNeural', 'zh-CN-YunxiNeural', 'zh-CN-XiaoxiaoNeural'],
    sampleClip: '00-title',
    rate: '-10%',
    window: (T) => [T.voice, T.sub[1] - 0.4],  // speech must end before the subtitle starts fading out
  },
};
