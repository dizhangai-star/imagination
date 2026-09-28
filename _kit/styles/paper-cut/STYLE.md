# Paper-cut diorama (kağıt kesik) — style guide

> Layered card cut-outs in a shallow box: each piece has a lit cut edge, fibre texture and a soft drop shadow
> that grows with its height; pieces rise, pop and hang on threads. Reference film: `baby-leyi` (14 scenes, 133.5 s).

## 1. What it is
Everything is **a piece of card**: flat colour, no painted shading, no outlines. Depth comes only from
**layering and shadow** (`z` = height above what's behind). The world is a diorama: hills are strips stacked
back to front, the sky is a gradient card, captions hang on threads. Motion is *theatrical and physical*:
pieces rise from below with overshoot, pop in with a bounce, drop in on a thread and sway, get pulled away.
Warm, handmade, gentle — made for family stories and explainers.

## 2. Story: native moves
| Move | Use |
|---|---|
| **Rise / sink** | A new place builds itself layer by layer from below; a scene change sinks A and raises B (`tS`). |
| **Pop** | Characters, props and each letter of a title pop on with overshoot. |
| **Hang** | Place tags, lanterns, stars, clouds, captions drop in on threads and sway (and are pulled out). |
| **Light moves** | `E.light(angle)` swings every shadow at once: time of day, a spotlight, a mood turn. |
| **Scale reveal** | End on the box itself: the whole story was one diorama / one card. |
| **Confetti** | Cut-paper hearts and dots for joy beats (births, reveals). |

## 3. Look
- `PAL`: board `#efe3cc`, cream, kraft, navy (type), terra (accents), red, pink/rose/blush, sage/leaf/moss
  (hills), sky, dusk, sun, gold, night, skin, hair, ink (marks), white, wood. Edit per film in `engine.html`.
- Fonts: **LXGW WenKai TC** (中文 400/700) + **Fraunces** (EN 600/900, italic 500). Fraunces italic `&` reads as
  "ℰ": set lines containing `&` upright.
- Caption card: cream card on two threads, 中文 above (navy 700 17px), English italic below (terra). It hangs at
  top centre (y ≈ 14–60, x ≈ 220–420): keep important art below y ≈ 65.
- Default clip timing: `fadeIn [0, .45]`, `cap [.7, d − 1.1]`, `fade [d − .45, d]` (to the bare board).

## 4. API — `const S = Kit.styles.paperCut(x, { PAL, ZH, EN, K })`
| primitive | signature | use |
|---|---|---|
| `piece` | `(path, col, { z, alpha, rim, sh, tex, detail })` | one cut-out: lit rim casts the shadow, main colour shifted off the light, fibre texture; `detail()` draws clipped inside |
| `P.poly/blob/rect/rrect/circle/ellipse/heart/star` | → path fn | shapes (`blob` = closed Catmull-Rom) |
| `strip` | `(tops, yb=420)` | ground/hill layer with a smooth top edge through `tops` |
| `mark` | `(fn(c), col, w)` | flat ink details (eyes, mouths, stitches, lettering) — no shadow |
| `at` | `(tx, ty, fn, { s, rot, sx, sy })` | group transform (shadows stay correct inside) |
| `rise` / `sink` / `pop` | `(t, t0, d, dist)` → offset / scale | motion with eBack overshoot; each registers a sound cue |
| `hang` | `(t, ax, len, t0, draw(ex, ey, rot), { t1, ph, swing, idle })` | threaded piece: drops, sways, pulled out at t1 |
| `paperText` | `(s, cx, cy, { t, t0, split: ''\|' ', size, font, weight, col, z, stagger, out })` | text cut from paper, units pop in turn |
| `confetti` | `(t, t0, cx, cy, { n, seed, cols, dur })` | hearts / rects / dots bursting and falling |
| `banner` | `(t, { zh, en }, T)` | the hanging caption card (engine draws it from `captions`) |
| `board` / `sky(top, bottom)` / `vignette(a)` / `texture(a)` / `fadeBoard(a)` | | grounds and finish |
| `light(angle=.98, len=1.45)` | | shadow direction for this frame (reset every frame) |

`z` guide: hills 2.4–3.6, figures 1–1.5, small parts 0.4–1. Shadow strength default `sh 0.5` (0.36 looked flat).

## 5. Gotchas (learned on baby-leyi)
- **Two-beat scenes** (day → night): beat A layers `sink` from about `tS − 0.15`, beat B layers `rise` from
  `tS + 0.5`, so the swap is clean.
- **Stepping out of a doorway**: draw the character twice — clipped to the doorway (between the dark opening and
  the door leaf) and in the front layer clipped to x > the door edge.
- **Characters** (`_cast.js` pattern): feet at (x, y), adults ~120 units tall at s = 1; options `{ t, s, flip,
  face, look, tilt, pose, arms: [[a1,a2],[a1,a2]], prop, propL }`; `t` drives breathing and blinking. Build a
  **cast sheet** clip and get it approved before any scene (Leyi needed 2 revisions: age, hair, glasses).
- **Hand-holding**: put the partners ~53 units apart at s = 0.8 and aim both arms at the joined hands.
- **Walking**: `walk(t, xa, xb, ta, tb)` → `{x, y, tilt}` with a bob (see `_props.js`).
- Keep a `_props.js` of reusable pieces (tags, lanterns, windows, water, steam, lamps) — scenes get short.

## 6. Sound
- One **music-box** track across the whole film (`soundtrack: 'film'`): tuned-comb partials, tine click, 3/4
  waltz; a tempo map can land a downbeat on the key moment (Leyi: the birth, with a key change up a step).
- **Paper foley is automatic**: `audio/cues.mjs` scans the picture for `rise` (→ soft tap), `pop` / `paperText`
  (→ pop), `hang` (→ high tick in key), `confetti` (→ sparkle). Accents by hand: `sfx: [[t, kind, {v, d}]]`.
- Balance: music high-passed 110 Hz (220 into the room); `BUS=1 node audio/music.mjs` prints bus levels;
  tune `TRIM`, `MUS`, `FX`. Leyi landed at −16 LUFS, peak −4.5 dBTP.

## 7. Reference
- `baby-leyi/PROGRESS.md`: cast API (`C.dad/mum/leyi/grandpa/grandma/relative/dog`), props, the S5 audio plan.
- Related idea bank: lemo-opuscar `styles/papercut-red` and `paper-popup` (fold–cut–unfold, holes are light,
  scraps come back later) — grammar only, don't copy designs.
- Template: `styles/paper-cut/template/` (sky, rising hills, sun pop, hanging cloud, cut-letter title, confetti).
