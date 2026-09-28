// Clip timing (seconds), the single source of truth: loaded by engine.html and by the kit's Node tools.
// Every clip fades in from black (fadeIn) and out to black (fade). Length = CLIP.duration.
window.TIMELINE = (A) => {
  const d = A.duration ?? 8;
  return Object.assign({ fadeIn: [0, 0.6], fade: [d - 0.7, d] }, A.timing || {});
};
// Clip length = its `duration` (03 cuts to black at 8.3 s and holds black to 9 s), else the end of its fade.
window.DURATION = (A) => A.duration ?? window.TIMELINE(A).fade[1];
