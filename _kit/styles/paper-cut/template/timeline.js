// Clip timeline, the single source of truth: loaded by engine.html and by the kit's Node tools.
// Defaults per clip; CLIP.timing overrides. cap = caption card in/out, fade = to the bare board.
window.TIMELINE = (A) => {
  const d = A.duration ?? 8;
  return Object.assign({ fadeIn: [0, 0.45], cap: [0.7, d - 1.1], fade: [d - 0.45, d] }, A.timing || {});
};
// Clip length (a clip may end on its own fade, so it isn't always fade[1]).
window.DURATION = (A) => A.duration ?? 8;
