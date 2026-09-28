# Megalophobia · 巨物

A film drawn entirely in code with the shared video kit (`../_kit`), style **cg-lab**.

**Start every session by reading `PROGRESS.md`** (state, decisions, next step). Read `TREATMENT.md` for the story.
Read `../_kit/README.md` for the engine contract and tools, and `../_kit/styles/cg-lab/STYLE.md` for the style's
primitives and gotchas, **instead of reading `engine.html` or the kit source**. Open kit source only to change it.

## Commands (run from this folder)
```bash
node preview.mjs <id> --every 1          # grid of frames every 1 s → frames/<id>-strip.png (cheapest review)
node preview.mjs <id> 3.2 --crop 380,160,160,110 --cols 1 --w 900   # zoom (logical 640×360 units)
node preview.mjs film                    # contact sheet: one frame per clip
node render.mjs <id> [--silent]          # clip → out/<id>.mp4 (+ its sound); --check = glyph check only
node compile.mjs                         # every NN-*.js clip → the film (config.film) + soundtrack
node ../_kit/audio/mix.mjs <id>|film     # redo sound only
node ../_kit/bin/check.mjs               # final QC: duration, −16 LUFS, true peak, black frames, silences
node ../_kit/bin/srt.mjs                 # subtitles → out/<film>.srt
node ../_kit/bin/clean.mjs               # what can be deleted (dry run; --yes)
```

## Working rules
- Review with `preview.mjs` grids (small `--w`) before any full render; zoom with `--crop` only where needed.
- Every clip starts and ends on the bare ground (the fade), so the film cuts are seamless.
- Everything deterministic: seeded `R(seed)`, never `Math.random()` or `Date.now()`.
- Clip files: `NN-*.js` are the film in order, `_*.js` are shared helpers (`uses: [...]`), others are dev clips.
- When a lesson is learned (a primitive's gotcha, a fix), add it to `PROGRESS.md` Notes — or, if it applies to
  every film in this style, to `../_kit/styles/cg-lab/STYLE.md`.
