// Overlay timeline (seconds), the single source of truth: loaded by engine.html and by the kit's Node tools.
// A clip may override any key via CLIP.timing. voice = when the narration starts (after the subtitle fades in).
window.TIMELINE = (A) => {
  const T = Object.assign({ title: [0.2, 1.8], sub: [2.3, 8.4], seal: 9.2, fade: [11.2, 12] }, A.timing || {});
  T.voice ??= T.sub[0] + 0.4;
  return T;
};
