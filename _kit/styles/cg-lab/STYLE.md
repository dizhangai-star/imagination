# CG lab (three.js 3D) — style guide

> A dark VFX studio seen through a DCC viewport: real 3D (three.js, WebGL2 in headless Chrome), a 2.39:1 letterbox,
> a mono HUD in the top bar, bilingual captions in the lower bar, grain and vignette. Reference film: `vfx-creature`
> (*The Making of a Creature*, 10 clips, 104 s).

## 1. What it is
Real-time 3D rendered frame by frame: PBR materials, ACES tone mapping, shadows, fog, custom shaders. The frame
is dressed as a **production viewport**: black letterbox bars, a HUD (stage, shot label, timecode, a red record
dot), captions set like a film title (Cinzel caps, tracked, over 繁體中文). The ground is **black**: every clip
fades from and to black, and the studio is a dark floor with a faint grid. It suits "how it's made" films,
technical explainers, sci-fi, and anything that wants a cinematic, epic feel with a camera that moves in space.

## 2. Story: native moves
- **Orbit push-in** on a subject on a pedestal or turntable (`orbit(ang, rad, hgt, target)` driven by t).
- **Scan-plane look switch** (the signature transition): one geometry, two materials with opposite
  `clippingPlanes`, plus an additive ring at the cut; the plane sweeps and the object changes look
  (sketch → clay → wire → textured). See the template's `00-title`.
- **Stage-by-stage build** of one asset with the HUD counting stages (`hud: { stage, label, tc0 }`).
- **Set swaps inside one shot** (toggle a set's objects' `visible` per frame), **match cuts** across them
  (keep an object's view-space pose), **slow motion** by warping t (below), 2D glass/lens effects in `overlay`.
- Fade from black, fade to black: clips join with plain cuts.

## 3. Look
- **Frame:** 1920×1080 render; overlays in 640×360 logical units (×3). Letterbox bars 46 px (picture 268 px,
  2.39:1); `letterbox: false` removes them. The camera fov is per clip (`fov`, default 32).
- **Palette:** background `#050608`, floor `#15171b`, grid `#2c3440`/`#1c2129`, key light warm `#ffd9b0`,
  rim cool `#7fb2ff`, scan/wire cyan `#5fd4ff`/`#8fe3ff`, HUD grey `#8a8f96`, record red `#c0392b`,
  caption cream `#e9e2d0` / `#b9b2a2`.
- **Fonts (Google Fonts, OFL):** Cinzel 600 (English captions, caps, tracked 3), Noto Serif TC 400 (中文),
  JetBrains Mono 400 (HUD). Kit.boot subsets Noto Serif TC to the clip's glyphs (`S.boot`).
- **Bands:** HUD in the top bar (y 23), captions in the lower bar (y 330 / 345). Keep titles inside the picture.
- **Finish:** vignette (`vignette`, default 0.55), grain from 8 seeded tiles picked by frame (`grain`, default 0.07).
- **Timing:** `fadeIn [0, 0.6]`, `fade [d − 0.7, d]` (timeline.js). Captions `caps: [[t0, t1, en, zh]]`, fading
  0.45 s at each end; hold ≥ 1.8 s.

## 4. API — `const S = Kit.styles.cgLab(x, { THREE })`
Load `style.js` as a classic script after `engine/core.js`; the film's module script imports three (importmap →
`_kit/node_modules/three`) and passes it in. Options: `THREE` (required), `EN ZH MONO` (font stacks), `W H`
(1920×1080), `BAR` (46), `fov` (32), `background` (`#050608`).

| member | does |
|---|---|
| `hdr` `samples` `shutter` `fps` (options) | opt-in HDR accumulation: the scene renders `n` times into a linear half-float MSAA target, each sub-frame at a time inside the shutter (`shutter` 0.5 = 180°, motion blur) with a Halton sub-pixel jitter (supersampling); the average is tone-mapped once. `n` = the page's `?samples=N` (render.mjs `--samples` / `config.samples`, preview `--samples`) or `samples`; `hdr: true` uses the same linear path even at n = 1 (so transparent materials blend in linear light). Off by default: other films render byte-identically |
| `renderer scene cam gl` | WebGLRenderer (offscreen canvas `gl`, preserveDrawingBuffer, ACES, sRGB, PCF shadows, local clipping), the scene, a PerspectiveCamera (near 0.05, far 400) |
| `frame(A, t, T, E)` | one frame: `A.setup(E)` once per clip → clip fov → `A.draw(t, E, T)` → render → copy into `#cv` → `finish` |
| `finish(A, t, T, E)` | vignette, grain, letterbox, captions, HUD, `A.overlay?.(t, E, T)`, fade |
| `studio({ grid, floor })` | dark floor disc (r 40, receives shadows) + faint grid → Group |
| `lights({ key, rim, keyI, rimI, fill })` | shadow-casting key, rim, hemisphere fill → Group (`userData.key/rim/hemi`) |
| `orbit(ang, rad, hgt, target, fov?)` | place the camera on an orbit and look at target |
| `text(s, x, y, font, color, a, align, spacing)` `caption(en, zh, a)` `hud(h, t, a)` `alphaIn(t, a, b, fade)` | 2D overlay helpers (logical units) |
| `boot` | `Kit.boot` options for this look: `cjkFamily`, `cjkWeights`, `zhText`, `fonts` |
| `EN ZH MONO BAR W H` | constants |

Clip fields: `id duration fov caps hud { stage, label, tc0 } vignette grain letterbox glyphs glyphsEn uses sfx`,
`setup(E)` (build scene objects once), `draw(t, E, T)` (set every changing value from t), `overlay(t, E, T)` (2D).
The template's `E` also carries `MarchingCubes`, `mergeGeometries`, `mergeVertices` and `Kit.math`.

## 5. Gotchas (learned on vfx-creature)
- **Determinism:** `setup` runs once per clip, on whatever frame renders first; `draw` must set *every* changing
  value from t (transforms, uniforms, visibility, camera, fov, fog, background). No state between frames.
  Anything computed once (a crack centre, a solved position) goes in `setup`, never lazily in `overlay`.
- Per-shot lens: reset `cam.fov` + `updateProjectionMatrix()` in every branch of a shot switch.
- three 0.186 ships no `three.module.min.js` (use `three.module.js`); `PCFSoftShadowMap` is gone (PCFShadowMap).
- `ShaderMaterial` on a SkinnedMesh: include the skinning chunks + `clipping: true` + the clipping chunks.
  `onBeforeCompile` snippets: end injected GLSL with a newline before the next `#include`/`#define`.
- Skinned meshes: `frustumCulled = false`; shadow acne → `shadow.normalBias ≈ 0.02` on the key light.
- Surface breakup at close range: never `hash(floor(p * k))` for colour/bump (reads as bricks); use smooth value noise.
- Fur as shells: z-fights when the length is ≈ 0 (hide the shells until they have length); reads as stacked
  discs within ~10 cm of the lens (hide with a 2D macro DOF in `overlay`).
- Transparent line looks: a depth-only prepass (`colorWrite: false`) + the lines with `depthFunc: LessEqual`,
  `depthWrite: false` = hidden lines removed with the background visible.
- Dust sprites read huge near the camera: scale them down, opacity ≤ 0.4. 2D glows: project with the camera,
  radial gradient, `lighter`, radius ∝ 1/distance.
- Match cut across a set swap: `V = camBefore.matrixWorldInverse × objectWorld` at the cut; after it
  `objectWorld = camAfter.matrixWorld × V`.
- Showing one scene inside another (shards, screens): render scene A, copy `renderer.domElement` into a 2D
  canvas (sync, thanks to preserveDrawingBuffer), then set up scene B for the engine's render.
- **Slow motion inside a clip:** author in scene time; `t = this.warp(t)` at the top of `draw` and `overlay`,
  `duration += extra`; a pure `unwarp` on the clip lets `audio/music.mjs` (via `loadClip`) place sound in scene
  time too. Cosine speed ramps avoid a visible jump (`vfx-creature/clips/10-final.js`).
- Keyframed character motion: monotone-cubic keys slow at every key; flag releases to pass at speed and hits to
  stop dead, and shoot swings side-on (front views foreshortened them into pose pops).
- The ground is black, so `check.mjs` sees the fades as black frames: the template sets `blackGround: true`
  (reported, not failed). Still look at the list for unintended black.
- Speed (M4 Pro): ~20 ms/frame for a simple scene; a furred character with 26 shells still renders a 20 s clip in
  about 30 s. The first frame of a clip pays for `setup`.

- **Sub-frame accumulation** (`hdr`/`samples`): `draw` runs once per sub-frame at `t ± shutter/2/fps`, so it must
  stay a pure function of t (it is called with t slightly < 0 on the first frame). Materials render into a target,
  so three skips their tone mapping — custom shaders with `#include <tonemapping_fragment>` work unchanged.
  GPU passes inside `draw` (FFT, bakes) must save/restore `renderer.getRenderTarget()`. Cost on imagnation (FFT ocean + 1080p mirror):
  16 sub-frames ≈ 2.7 s/frame vs 0.23 s at 1 sample (~12×): a 7 s clip renders in ~10 min. Preview at 1 sample.

## 6. Sound
Epic hybrid, all synthesized in `audio/music.mjs` (`soundtrack: 'film'`): subtractive `syn` voices (detuned
PolyBLEP saws through an SVF low-pass), pads, brass, strings, taiko/timpani/boom hits, risers, braams, a tape
stop; sound design as a cue sheet per clip in clip seconds (the template reads `CLIP.sfx: [[t, kind, {v, d}]]`,
kinds = the kit's foley + `boom riser scan`). Balance: `BUS=2` prints music | sfx RMS per 0.5 s; hits −4…−7 dB,
accents within ~3 dB of the music, near-silence ≤ −27. Bright noise (cymbal, glass) + a hard limiter pushes the
true peak after AAC: limit against the 99th percentile × 0.7. Real glass is noise (crash + crunch grains + a low
blast), not sine partials. The reference film's score (`vfx-creature/audio/music.mjs`) has every voice.

## 7. Reference
`vfx-creature`: a code-built ape (SDF → surface nets, skinned, fur shells, blend-shape grin) through a VFX
pipeline, ending on a "Dawn of Man" homage with a twist. Film-specific helpers stay in the film (`_ape.js`,
`_props.js`, `_shots.js`: poses/keys/IK, props, debris, glare, glass shatter); copy what a new film needs.
