# Megalophobia · 巨物: Progress

**Resume here:** read this file (and `TREATMENT.md`), then continue from **Next step**.

## Next step
Sprint 4 cut is `out/sprint4-draft.mp4` (30 s, silent; not in git — re-render with `render.mjs` + `compile.mjs`).
**User review (2026-09-29): the water wall in 03 looks like a texture/decal.** Picture lock is on hold until the
wall is redone → **Sprint 4b · Wall upgrade** (below). Work moves to a faster machine (repo:
github.com/dizhangai-star/imagination, root = `videos/` with `_kit/` + `imagnation/`; run `npm install` in `_kit`).
Then Sprint 5: sound (turn every clip's `sfxDraft` into `sfx`, score `audio/music.mjs`).

**Sprint 4b status (2026-09-29): A + B + C + D done** → `out/style-frames-4b.png` (before | after, 16 samples, at
4 / 6 / 7.5 / 8.1 s; A + B alone: `out/style-frames-4b-AB.png`), `out/03-wall.mp4` re-rendered. Waiting for the user's
review; then re-compile the cut (`compile.mjs --out out/sprint4b-draft.mp4 --silent`) → picture lock → Sprint 5.
Not used yet: `update({lean})` (pushes the whole crest forward) — the crest leaves the frame at 7.5 s, so it wouldn't show.

### Sprint 4b · Wall upgrade (proposed plan: do A + B first, show a style frame, then C + D)
Why it reads as a texture (diagnosis on 03 frames):
1. Streaks are painted colour in `faceShade(x, hN)` on a smooth surface — no normal, no reflection, no parallax.
2. Detail is in height *fraction* `hN`, so it stretches with the wall (50 → 620 m = ×12): at 8 s the streaks
   become wide soft curtains — the most "texture-like" moment.
3. No aerial perspective: the wall is 7–15 km away but as crisp and contrasty as the foreground.
4. The face is shaded differently from the sea (sea = FFT + Fresnel + transmission; wall = hand-tuned colours).
5. Crest silhouette is a smooth sum of sines; a 1 km body of water should be torn, steaming, spilling.
Not a three.js limit: only true breaking-wave fluid sim (FLIP) is out of reach. A tidal bulge is a moving
mountain of water, not a breaking wave: dark, smooth, misty, low contrast, sold by scale and air (grammar
reference: the Miller's-planet wave in *Interstellar* — learn the haze/scale, don't copy shots).
- **A · Aerial perspective + metric detail** (cheapest, biggest win): haze by distance (Beer–Lambert toward a
  cool horizon colour, contrast down, detail fades with range); all face noise in **metres** (x, height above
  level, flow-advected v = h + speed·t), never `hN`, so detail grows naturally as the wall approaches.
- **B · Same water BRDF on the face**: sample the FFT slopes on the face (tangent frame of the ridge profile,
  stretched along the downslope flow), add the ridge's own slope; Fresnel reflection of sky/planet (env / mirror
  taps as on the sea), transmission + SSS through the thin upper lip (backlit green-grey), sun glint. Foam = a lit
  layer with its own normal/roughness (streaks of aerated water), not colour blobs. Keep `faceShade` for the
  mirrored copy in the sea but drive it by the same functions.
- **C · Geometry**: dedicated wall mesh (dense grid in screen space around the crest, not the sea's 150 m rows),
  displaced by metric flow noise (bulges, gullies); crest silhouette broken by fbm + spilling lobes; last 1 s the
  top may lean forward slightly. Keep `SURFACE` ridge for the sea/sand interaction.
- **D · Volumetric spray/mist**: replace the 2D `makeSpray` plane with a raymarched volume (slab above the crest,
  density = fbm advected shoreward/up), sun single-scatter (HG g≈0.6, sun behind camera → soft back-scatter),
  self-shadow by a few light-march steps; mist also lowers contrast of the upper face.
- Verify: style frames `node preview.mjs 03-wall 4 6 7.5 --cols 3 --w 640` + `--crop` on the face; before/after
  side by side for the user. Budget: ≤ 8 s/frame at 16 samples (03 ≈ 35 min).
- Also open for review: wall fills the frame only 7.5–8.3 s (maybe longer); streaks too broad close up (fixed by
  A); 04's English physics line is dim.

## Decisions (locked)
- **Style:** cg-lab (`../_kit/styles/cg-lab/STYLE.md`)
- **Format:** 16:9, 1920×1080, 30 fps, 30 s, 4 clips (7 + 8 + 9 + 6), letterbox 2.39:1, no studio HUD
- **Language / captions:** English (Cinzel caps) over 简体中文 (Noto Serif SC — engine.html overrides the style's TC)
- **Fonts:** Cinzel, Noto Serif SC, JetBrains Mono (physics readout, CJK falls back to Noto Serif SC)
- **Audio:** soundtrack 'film'; no narration; surf/wind → drone → roar → hard silence → one wave
- **Series:** 恐惧 / Fear, ep. 1 巨物恐惧症. `clips/_world.js` is the reusable world (physics, sky, ocean, sand, planet)
- **Physics:** Jupiter-mass rogue planet; numbers from `WORLD.physics()`; distance keys `WORLD.KEYS` (film seconds → km)
- **Art:** all drawn in code, no image models
- **Readout frames it as Earth vs a Jupiter-mass body, not Earth–Moon** (user, 2026-09-29): 天体 木星质量行星 (318 ×
  地球质量) · 距离 (地球离木星最近时的 1/N, 5.88e8 km) · 视直径 (地球上所见木星的 N 倍, 50.1″) · 潮高. End card
  (04) must use the same yardsticks, not "2.4 倍地月距离"
- **Planet azimuth** −0.3 rad (exactly opposite the sun at az +20°) in every clip, so it's lit full
- Sound cue drafts live in `sfxDraft` (music.mjs throws on unknown `sfx` kinds); Sprint 4 turns them into `sfx`

## Sprints
- [x] **0 · Brief + treatment + look v1** (`out/style-frames-v1.png`)
- [x] **1 · Look fixes** → `out/style-frames-v2.png`: mid-ground water, planet detail, water-wall streaks + spray
  → `out/style-frames-v3.png` : lobed shoreline + wet line, torn wall reflection, broken planet reflections
  → `out/style-frames-v4.png` (**approved**): wall face = water (translucent lip, foam lace/sheets, churn), mirrored in the sea
- [x] **2 · Clips 01-shore + 02-rise** → `out/sprint2-draft.mp4` (silent), `frames/film-sheet.png`
  01: POV walk along the wet sand (x 4 → −1.5 m, z 3.4), stops 3.2–6 s; head lifts/turns yaw −1.35 → −0.36,
  our own footprints lead ahead; arc enters frame right ~3.5 s; fov 34 → 29 lean-in. 02: tripod z 12, 85 mm
  fov 16 → 11, planet elev −0.12 → 0.3 ang, level 0 → −3 m, wet = 0.14 − level. `00-title` demo deleted.
- [x] **3 · Water upgrade** (user, 2026-09-29) — A: sub-frame motion blur + jittered supersampling (kit, opt-in);
  B: FFT ocean (Tessendorf, 3 cascades, choppy + Jacobian foam) replacing swell + normal map; C: rough/blurred
  reflections + glitter path; D: depth absorption + crest scattering. → `out/sprint3-water-draft.mp4` (16 samples)
- [x] **4 · Clips 03-wall + 04-wake** → `out/sprint4-draft.mp4` (full 30 s silent cut) — picture lock pending
  03: 135 mm (fov 8.2 → 7.4) low at z 12, planet elev 0.32 → 0.42 ang; ridge crest horizon → mid-frame 5.5 s →
  past the top 7.5 s (`H` 620 m, `z` −16 → −5 km, k^3.2), spray ramps 3.5–6.5 s, seeded sine shake from 5 s, hard
  cut to black at 8.3 (`fade [8.26, 8.3]`). 04: 01's last framing, `kind: 'moon'` at real size, fade-in 1.4 s,
  title MEGALOPHOBIA / 巨物恐惧症 + physics line (1/N computed from `physics(distAt(24))`) in the sky above the Moon.
- [ ] **5 · Sound** (no narration) → mixed draft
- [ ] **6 · Polish + delivery**: compile, check.mjs OK, srt, poster, STYLE.md gotchas

## How it works
- `engine.html?clip=<id>` loads `<clipDir>/<id>.js`; `window.renderAt(t)` draws frame t. Timing in `timeline.js`.
- `clips/_ocean.js` → `window.OCEAN` (FFT ocean, see its header); every world clip has `uses: ['_ocean', '_world']`.
- `clips/_world.js` → `window.WORLD`: `build(E, {sunElev, sunAz, exposure, kind, prints, ocean})` once in setup;
  `placeBody(w, ang, az, elev)`; `update(E, w, {t, level, wet, surge, ridgeZ, ridgeH, ridgeW, foam, bright})` every frame;
  `readout(E, filmT, alpha)` in overlay; `physics(dKm)`, `distAt(filmT)`.
- World axes: metres, viewer near origin looking −z to sea, sand y = 0.035·z. Sun behind the camera (az 15–20°, elev 4°)
  so the planet is lit full like a rising full moon. Planet/moon sit at 30 km, scaled to their real apparent size.

## Notes
- Water = three's Water.js (planar mirror) with patched shaders: vertex displacement (swash surge + tidal ridge),
  shore foam/transparency from depth over the analytic sand, ridge occludes its own reflection, ridge face shading.
- GLSL value-noise hash: wrap the cell index (`mod(p, 289.)`) — at world-scale coordinates the plain hash lost
  precision and the foam turned into rectangular blocks.
- Sky: Preetham `Sky`, turbidity 1.5, rayleigh 2, exposure 1.0 — others went green/brown under ACES.
  `WORLD.grade(E)` (first thing in every overlay) multiplies #ffeaf3 over the picture to cancel the leftover green.
- Hashes are integer PCG (`pcg`, `h21`, `h31`) — float hashes gave blocks/speckle at world-scale coordinates.
- Planet: `bakeGiant()` renders a 4096×2048 equirect albedo once per clip, reads it back and uploads it as a
  mipmapped DataTexture (render-target mips were never built → minification speckle). Keep bake noise octaves
  below ~325 cycles/unit (texel Nyquist). Runtime lookup uses two u parameterisations (`u1 = fract(ur)`,
  `u2 = fract(ur+.5)-.5`, RepeatWrapping) with the smaller gradient for a seam-free textureGrad.
- Water: long swell (4 directional waves, shoaling to 0 at the waterline) in `swell()` shared by vertex + fragment;
  Water.js distortion clamped to `min(1/distance, 0.015)`; normal map 64 waves incl. fine chop, `size` 2.4.
- Ridge: asymmetric profile (steep shoreward front, 4× longer back); `STREAK(x, hN)` = water pouring down the face,
  also used for the ridge's reflection in the calm water in front; `makeSpray()` veil on the crest
  (`update` params `spray`, `sprayH`).
- Speed: a style frame renders in ~1–2 s incl. the ~0.5 s planet bake on the clip's first frame.
- Shoreline: `SWASH` `swashRetreat(x, t)` (shared by water + sand) — the waterline only *retreats* (fragment depth −=,
  alpha → 0 over the sand) because the coarse water mesh can't climb the sand; the sand's wet line uses the same lobes.
  Its retreat must swing 0 → max along x (not saturate), or at 135 mm it reads as a uniform straight band again.
- Far water: the normal map averages to flat past ~200 m, so everything that must break up at long range (mirror
  row/side shifts `rowN`/`rowX`, wall-reflection tear `tearN`) uses explicit fbm stretched along x, not surfaceNormal.
- Debugging a mask: temporarily tint it pure red in the shader, crop with preview, revert (backup the file first).
- Wall: `FACE` `faceShade(x, hN, det, foam)` shades the wall face AND its reflection (det 0 = soft mirror version),
  so the reflection is the same wall inverted. Look it up at the x where the reflected ray meets the wall
  (`xWall = eye.x + vd.x·(eye.z − ridgeZ)/−vd.z`), not the water point's x, or the mirrored streaks shrink to noise.
- Water grid rows: ratio 1.0172 × 560 (≈150 m rows at 9 km, ends ~−16.8 km). At 1.058 the ridge front was ~2
  triangles tall → a flat slab with a ruler-straight top.
- Far-sea noise: fade any term by `fwidth(worldPosition.z)` × its z-frequency (aaT/aaL) or it aliases into wiry lines.
- Sand relief is in metres (`sandH(p, aR, aG)`): shore-parallel ripples λ 12 cm + grain, each faded by
  `fwidth(xz)` against its period. The old value-noise bump read as a blotchy checker at ≤ 10 m under the 4° sun.
- Footprints: `build(E, {prints: [[x, z, heading, side±1], …]})` (≤ 24) → sole SDF (heel→ball capsule + toe dent),
  2 cm deep with a low rim; separate heel/ball/toe ellipses read as donuts.
- Drained flat: mirror-smooth runnels (`sheet`) between the sea and the old run-up line; subtle at dusk (they
  reflect the mauve horizon sky, near the sand's tone).
- **Water v2 (Sprint 3).** `_ocean.js`: Tessendorf FFT, JONSWAP + narrow swell, 3 cascades (L 317/53.3/9.1 m, band
  edges k 0.6/3.5), 256², GPU Stockham IFFT (MRT float targets, 16 passes/cascade), stateless in t. Verified once with a
  numeric probe (read back the IFFT): slopes match finite differences of h (3 %), Hs matches the spectrum. Defaults in `build`:
  wind 2.2 m/s, fetch 20 km, `damp` 2.5 rad/m, swell Hs 0.45 m λ 55 m → Hs ≈ 0.5 m, slope variance ≈ 0.003.
- Phillips tail: slope variance of a JONSWAP sea is ~0.017 even at 2 m/s (it barely depends on wind). That smears
  the mirror over ±45° at grazing angles and the planet's reflection vanishes. A glassy dusk sea needs `damp`
  (exp(−(k/damp)²)) — physically, light air doesn't raise ripples.
- Reflection taps: 12 taps across the sub-pixel slope distribution (mip variance E[s²]−E[s]²) along the view's
  vertical, weighted by visibility (el + s)·[el + 2s > 0] and per-tap Fresnel. Mirror offset = +s / tan(fov/2) in uv
  (sign found by a constant-slope test). Back faces: clamp the resolved slope to ≥ −0.45·el, or 1-px dark dashes
  appear on the swell's back slopes.
- Water alpha = 1 − (1−F)·T (Beer–Lambert, path down and back): the rendered sand shows through with the right
  tint; `hdr: true` makes that blend happen in linear light.
- Wet sand must mirror the sky too, or the swash sheet reads as a raised slab: `sat` band (roughness 0.025) above
  the swash + IBL radiance ×(1 + 0.8·wet + 1.2·sat) in the sand shader (scene env is at 0.5).
- Mirror target is 1920×1080 with mipmaps (blur by `lod` from the sideways slope spread).
- Render: `config.samples` 16 (motion blur 180° + AA); previews stay at 1 sample unless `--samples`.
- `timeline.js` `DURATION(A)` = `A.duration` (the kit otherwise ends a clip at its fade end — 03's cut to black
  at 8.3 s would have shortened the film by 0.7 s).
- Wall seen off-axis (camera az −0.3): streaks on the sloped face read diagonal. `update({ridgeSkew: tan(az)})`
  shears the face's x lookup (`x + (z − ridgeZ)·skew`) so they pour straight down the screen.
- Spray veil: a hard base (smoothstep 0 → 0.06) reflected in the sea as thin vertical scratches and sat as a
  detached cloud bank; base now at 0.75 H with a soft fade (0.04 → 0.3), so it grows out of the crest.
- **Wall v2 (Sprint 4b A + B).** `FACE` is now `wallShade(P, x, hM, H, N0, E, fx, fv, det)`: relief of the sheet
  pouring down in metres (`wallRelief`, analytic-derivative value noise, octaves fade by pixel footprint `fwidth`),
  Fresnel reflection of the sky from `uSkyCube` (a 128² CubeCamera render of the Preetham sky, built once in `build`),
  body lit by the sun behind us, lip transmission, lit foam, aerial perspective `exp(−d / uHazeL)` (24 km) toward the
  horizon sky in the view direction. Gotchas found: (1) the face must NOT use the sea's FFT slopes — they lie across
  the steep face in xz as fine horizontal lines; use the ridge slope only (`slR`). (2) The face is concave: a
  reflected ray below the crest's elevation hits the wall, not the sky → `occE` test (with the smooth-profile normal
  mostly, or its edge is a sawtooth); this is what gives the dark foot. (3) The mirror copy is shaded from the
  mirrored eye (y = 2·level − eye.y), not a sign-flipped view vector. (4) Strong relief normals make the reflection
  flip between blue zenith and the warm horizon → keep slope amplitudes ≤ 0.08.
- **Wall v3 (Sprint 4b C).** The sea mesh no longer carries the ridge; `makeWall` is its own mesh: 720 columns × 220
  rows (profile parameter s, crest at 0, dense there, front s > 0 to 2.4 rw, back to 9.6 rw), columns spanning only the
  camera's view at the crest distance (`uX`, set per render in `scene.onBeforeRender`). Displaced in metres: bulges
  (420 × 650 m) and gullies moving down with the flow, crest height torn by noise, spilling lobes lean forward. Normal
  by finite differences in the vertex shader. Gotchas: every x-lookup that shapes the face (bulges, crest height) must
  use the skewed x (`x + dz·tan(az)`) or features run diagonally down the screen; fine crest noise must be confined to
  the top (`pow(g, 12)`) or each crest bump grooves the whole face into corrugation.
- **Spray v2 (Sprint 4b D).** `makeSpray` = raymarched volume behind a proxy plane one ridge-width shoreward of the
  crest (0.5 → 1.8 H): 18 steps to 0.35 rw behind the crest, fbm3 density stretched up and leaning shoreward, confined
  above the analytic surface and around the crest, gated by bursts along x (evaluated once per ray); one light step for
  self-shadow; two-lobe HG (sun behind us → back-scatter). Gotchas: (1) don't stop the march at the analytic surface —
  the mesh crest is torn differently and a clear strip appears above it; the wall mesh occludes by depth anyway.
  (2) The sea's mirror pass renders nested INSIDE the main render, so per-camera switches belong in the object's own
  `onBeforeRender`, not `scene.onBeforeRender`. The spray is off in the mirror pass (`uOn`). (3) At samples 16 the frame
  came out white (empty canvas) until the spray's output was guarded against NaN/Inf (`discard`); 8 and 12 worked.
- Camera-dependent uniforms (`uTanH`, `uAspect`, wall `uX`) are set per render from the camera actually used, not in
  `update` — the clips set the camera after `update`, so these lagged one frame (01/02 zoom).
- Numeric checks of GPU passes: open the clip in puppeteer and `readRenderTargetPixels` (`OCEAN.make(...).readRaw(t, c)`).
