# Video kit

Shared engine, style packs and tools for films drawn entirely in code (no image or video models):
**chinese-zodiac** (ink wash, 14 clips), **baby-leyi** (paper cut, 14 scenes) and **vfx-creature** (cg-lab, three.js 3D, 10 clips) run on it. Read this file
instead of the kit source; open the source only to change it.

```
_kit/
  engine/core.js          Kit.math: cl lerp seg eOut eIn eInOut eBack ez R(seed) hex shade mixHex spline loop
  engine/runtime.js       Kit.boot(): clip loading, fonts, glyph check, live loop · Kit.glyphCheck
  styles/<style>/style.js Kit.styles.<style>(ctx, opts) → primitives   STYLE.md: look, API, gotchas, sound
  styles/<style>/template the files new-film.mjs copies for that style
  templates/common/       wrappers, CLAUDE.md, PROGRESS.md, TREATMENT.md for every new film
  lib/film.mjs            film model: config, clips, loadClip (Node), film layout, Chrome path
  bin/                    render preview compile check srt clean new-film
  audio/                  dsp.mjs (voices, reverb, WAV) sfx.mjs (paper foley) cues.mjs narrate.mjs mix.mjs
  node_modules/           puppeteer-core + three (3D films, via importmap), once for every film (films have no node_modules)
```

## Start a film
```bash
node _kit/bin/new-film.mjs <name> --style paper-cut|ink-wash|cg-lab --title "…" [--seal 印章]
cd <name> && node preview.mjs 00-title --every 1        # the demo clip as a frame grid
```
Film folders live next to `_kit/` (`videos/<name>/`), so pages load `../_kit/...` by relative path.

## A film folder
| file | role |
|---|---|
| `film.config.mjs` | `{ title, style, clipDir, global, param, fallback, film, fps, samples, crf, soundtrack, filmFadeOut, subtitles(A,T), narration, blackGround }` (`blackGround: true` = the style fades to black; check.mjs reports black frames without failing) |
| `timeline.js` | `window.TIMELINE(A)` → the clip's timing (defaults merged with `A.timing`); optional `window.DURATION(A)`. Loaded by the page **and** by Node, so there is one source of truth. Must include `fade: [start, end]`. |
| `engine.html` | loads core → style pack → runtime → timeline; sets palette/fonts; defines `window.renderAt(t)` (ground → `A.draw(t, E, T)` → overlays → fade) and calls `Kit.boot({...})` |
| `<clipDir>/NN-*.js` | the film, in order. Each sets `window.<global> = { id, duration?, timing?, uses?, glyphs?, sfx?, draw(t, E, T) }` |
| `<clipDir>/_*.js` | shared helpers, loaded by `uses: ['_cast']`; other names are dev clips (not in the film) |
| `audio/music.mjs` | the score. `soundtrack: 'film'` → writes `audio/build/film.wav`; `'clip'` → `<id> --secs S` writes `audio/build/<id>-music.wav` |
| `render.mjs` `preview.mjs` `compile.mjs` | one-line wrappers that import `_kit/bin/*` (so `node render.mjs <id>` works in the film folder) |
| `CLAUDE.md` `PROGRESS.md` `TREATMENT.md` | how to work here · state and decisions (resume point) · story plan |

## Engine contract
- 640×360 logical units, scaled ×3 to 1920×1080. `renderAt(t)` is a pure function of t: seeded `R(seed)`,
  no `Math.random()`, no `Date.now()`, no state carried between frames. Any frame renders alone, in any order.
- Every clip fades in from and out to the same bare ground, so `compile` joins clips with plain cuts.
- `Kit.boot({ dir, global, param, fallback, zhText(A), fonts(A, zh) → [[cssFont, text]], cjkFamily?, cjkWeights? })`
  sets `window.CLIP`, `duration`, `clipHan()`, `glyphCheck()`, `sceneReady`. URL: `engine.html?clip=<id>`
  (`?record` = no live loop). Open `engine.html?clip=<id>` in a browser for a live looping preview.
- Style packs are factories bound to the canvas: `const S = Kit.styles.paperCut(x, { PAL, ZH, EN, K })` (3D: `Kit.styles.cgLab(x, { THREE })`,
  loaded as a classic script; the film's module script imports three and passes it in). The
  film spreads what it needs into `E`, the object every clip's `draw(t, E, T)` receives.

## Tools (run inside a film folder)
| command | does | cost |
|---|---|---|
| `node preview.mjs <id> <t…>` / `--every S` | frames → one PNG grid `frames/<id>-strip.png` (`--w 640`, `--cols 3`) | ~3 s |
| `node preview.mjs <id> <t> --crop x,y,w,h --cols 1 --w 900` | zoom on a region (logical units) | ~3 s |
| `node preview.mjs film [--at 0.5]` | contact sheet, one frame per film clip | ~1 s/clip |
| `node render.mjs <id> [--silent] [--check] [--samples N]` | clip → `out/<id>.mp4`, then its sound; `--check` = glyph coverage only; `--samples` = cg-lab sub-frames (default `config.samples`) | ~0.5× real time |
| `node compile.mjs [--silent]` | all `NN-*` renders → `config.film` (+ film soundtrack) | ~1 min |
| `node ../_kit/audio/mix.mjs <id>\|film` | redo sound only (video stream copied) | 5–30 s |
| `node ../_kit/audio/narrate.mjs <id> [voice]` / `--samples` | edge-tts narration → `audio/build/<id>-voice.wav`; audition voices | network |
| `node ../_kit/audio/cues.mjs [--force]` | scan clips for motion cues → `audio/build/cues.json` (auto, cached) | ~3 s/clip |
| `node ../_kit/bin/check.mjs [file]` | QC: duration vs layout, −16 LUFS ±1, true peak ≤ −1 dBTP, black frames, silences | ~10 s |
| `node ../_kit/bin/srt.mjs` | `config.subtitles` → `out/<film>.srt` (flags subtitles < 1.8 s) | instant |
| `node ../_kit/bin/clean.mjs [--frames\|--drafts\|--cache] [--yes]` | reclaimable disk (dry run by default) | instant |
| `node ../_kit/lib/film.mjs [<id> <field>]` | film layout, or one clip field (`timing`, `narration.zh`) | instant |
| poster | `node preview.mjs <id> <t> --cols 1 --w 1920 --out out/poster.png` | ~3 s |

## Sound
- **dsp.mjs** — `rng(seed)` → `{rnd, jit}`; `voices({sr, n, rnd, music, sfx})` → `partials`, `mbox` (music box),
  `pluck` (guzheng: bends, vibrato, nail click), `noise` (filtered bursts/sweeps), `glide` (pitch sweeps);
  `freeverb(inp, spread, {room, damp, pre})`, `hpf`, `level`, `writeWav` (peak −1 dBFS). Keep the rnd call order
  stable and a score renders bit-identically.
- **sfx.mjs** — `foley(V, {rnd, jit, sfx})`: pop tap click boing bip thump squish ding tram clink flick whoosh clap
  wood sizzle. `AUTO` maps engine cues (rise/pop/hang/confetti) to kinds; clips add accents with `sfx: [[t, kind, {v, d}]]`.
- **mix.mjs** — `'clip'`: music + narration per clip (voice EQ/compression, sidechain duck ≈4 dB, fade with
  the picture, two-pass loudnorm −16 LUFS / −1.5 dBTP, AAC 192k). `'film'`: one track, normalized once,
  sliced for single clips so levels match the film.
- **narrate.mjs** — edge-tts (free, unofficial use of Microsoft's service; fine for personal films). For
  published/commercial films swap `speak()` for Azure Speech (same voices, licensed) or a local TTS model.

## Conventions
- Film clips `NN-name.js`, two digits, in order. Keep art out of the caption band and the title column (see STYLE.md).
- Caption hold ≥ 1.8 s and ≥ spoken line + 0.6 s; a title card ≥ 4 s.
- Fonts come from Google Fonts at render time (network). `render.mjs --check` verifies every Han character is covered.
- New lesson about a primitive → that style's STYLE.md "Gotchas". Film-only lesson → the film's PROGRESS.md.
