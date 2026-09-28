# Ink wash (水墨) — style guide

> Monochrome ink on warm rice paper: brush strokes that ink in along their length, soft washes that bloom,
> a red seal as the only strong colour. Reference film: `chinese-zodiac` (14 clips, 203 s).

## 1. What it is
Every mark is **ink laid by a brush**: a stroke has a direction, a wet start and a dry tail (飛白), and it
*appears along its length* as it is painted. Forms are built from few strokes plus graded washes; empty
paper is part of the composition (留白). Colour is ink black in all its dilutions, with **red only for the
seal and tiny accents** (an eye, a tongue, a sun). Motion is slow and calligraphic: things ink in, breathe, and
make one clear gesture (a head toss, a roar, a leap) late in the clip.

## 2. Story: native moves
| Move | Use |
|---|---|
| **Inking in** | A subject is *painted* into being, stroke by stroke (`p` 0→1). The reveal is the entrance. |
| **Wash blooms** | Mist, mountains and moods spread like water on paper; a wash can become the next scene. |
| **留白 / empty paper** | Hold space; one small subject against a lot of paper reads as scale and calm. |
| **The seal** | A red stamp lands as the full stop of a clip (and the only hard accent). |
| **One gesture** | After the painting settles, the subject does one alive thing (9–13 s in a 15 s clip). |

## 3. Look
- Paper `#efe6d2`, ink `#161614`, seal `#b8322a`; washes use `#2a2a26` at very low alpha.
- Fonts: **LXGW WenKai TC** (titles 700, captions 400) + **Noto Serif TC** (English). Traditional characters.
- Layout (zodiac): vertical title in the left column (x ≈ 80, keep art right of x ≈ 130); narration and
  captions in the top band (keep art below y ≈ 75); seal under the title.
- Clip rhythm (zodiac, 15 s): title 0.2–1.8 · narration subtitle 2.3–8.4 · traits 8.5–13.3 · seal 13 · fade 14.2–15.

## 4. API — `const S = Kit.styles.inkWash(x, { INK, PAPER, SEAL, ZH, sealText })`
| primitive | signature | use |
|---|---|---|
| `brush` | `(pts, w, p, al=.6, seed, taper, col)` | dry, dot-stamped stroke: leaves, grass, fur, outlines, contours |
| `ribbon` | `(pts, w, p, al=.8, taper, seed, col)` | smooth wet stroke, soft bleed, 飛白 at the start: long bodies, tails, branches |
| `mass` | `(pts, p, al=.7, seed, shade=[.3,.5], col)` | closed soft body (closed spline), blurred bleed, darker wash pooled toward `shade` |
| `wash` | `(cx, cy, rx, ry, al, p, seed, col)` | graded wash from many faint ellipses: mist, mountains, shading |
| `ground` | `(y, p, seed, al)` | horizontal ground mist across the frame |
| `rock` | `(outline, p, seed, fill)` | clipped inner wash + dry contour strokes |
| `blob` | `(cx, cy, rx, ry, rot, p, al, col)` | filled ink dot: eyes, blossoms, heads |
| `moon` | `(cx, cy, r, p)` | thin ring |
| `vtext` / `textLine` / `seal` | | vertical title inking in · one line of text · red seal (two chars) |
| `paper()` | | the ground: paper colour + seeded speckle (call first every frame) |
| `taper.{even, head, leaf, flat}` | `u → width` | width profiles; write your own `u → w` for heads/snouts |
| math | `cl seg ez R spline loop circle` | `ez` is unclamped here and `R` is Park–Miller (zodiac originals) |

## 5. Gotchas (learned on the zodiac)
- **`mass` alpha** ≈ 0.4–0.55, or it goes black. Draw limbs *before* the mass so its translucent edge covers their tops.
- **Heads through width, not blobs**: shape a head/snout with the ribbon's width profile `tp(u)` (neck pinch,
  head swell, rounded snout); the tip cap is part of the outline, so no knob or overlap.
- **Thin strokes**: `ribbon`'s 飛白 streaks read as white bars on anything under ~4 units wide (antlers,
  whiskers, flames, tongue). Use a clean tapered fill (a local `line()`) there.
- **Paint limbs extremity-inward** so the dry 飛白 lands on hands, feet, tail tips (ears: tip → root).
- **Overlapping translucent parts** (neck on body, limbs under body) double up into dark bands. Clip the
  under-part to *outside* the body (`rect(0,0,640,360)` + body loop, `clip('evenodd')`); if a pale rim shows,
  carry the tone in with a small `wash` clipped inside, or taper the part into the body.
- **Legs under a body**: draw each leg twice — clipped outside the body at full alpha, and inside at ×0.3.
  Clip in the *unrotated* frame, then apply head/neck pivots.
- **Silhouettes**: never a plain oval. Give each animal its own outline (girth, flank tuck, withers, hip, rump
  slope) and run the brush lines along it. Limbs need a pinched wrist/ankle and a fuller forearm/calf.
- **Clouds (祥雲)**: stroke the lobe circles, then erase inside with *full-alpha* PAPER (partial alpha ghosts arcs).
- **Scale around the ground contact**: `x.translate(p); x.scale(s, s); x.translate(-p)` enlarges without retyping coordinates.

## 6. Sound
- Guzheng-style plucks (`voices().pluck`): bends (按音) and vibrato (揉弦), a 刮奏 sweep under the title, a sparse
  low bed under the narration, the melody when the text changes, a firm low octave on the seal. D gong
  pentatonic (D E F♯ A B); Freeverb hall `{ room: .86, damp: .35, pre: .025 }`.
- Narration: edge-tts `zh-TW-HsiaoChenNeural`, rate −10% (chosen over YunJhe / Yunxi). ~4.3–4.7 s per line fits
  a 6 s subtitle window. Mix per clip (`soundtrack: 'clip'`).

## 7. Reference
- `chinese-zodiac/PROGRESS.md` "Per-animal notes": how each of the 12 animals was built (snake = one ribbon
  with a custom width profile; dragon = ribbon body through clouds, 見首不見尾; tiger = clipped stripes + roar).
- Template: `styles/ink-wash/template/` (vertical title, narration line, seal, per-clip guzheng + voice).
