# Megalophobia · 巨物: Treatment

## 1. Brief
- **Series:** 恐惧 / Fear, episode 1 — 巨物恐惧症 (megalophobia). Later episodes reuse this film's world kit
  (`clips/_world.js`: sky, ocean, beach, planet, physics readout).
- **Source:** the user's recurring dream — walking on a beach, a giant planet keeps coming closer.
- **Length:** 30 s, 4 clips. **Look:** photoreal as far as three.js allows in headless Chrome, kept light
  (one planar reflection, procedural textures, no image assets). cg-lab engine, letterbox 2.39:1, no studio HUD.
- **Captions:** 简体中文 + English. **Narration:** none (sound design + score carry it).
- **Physics is real:** every number on screen comes from `physics()` in `_world.js` (below).

## 2. Logline and arc
A calm walk on a beach at dusk; something rises from the sea that is far too big — and the sea runs away from it.
- **Setup (01):** quiet shore, gentle swash, dusk. A pale arc on the horizon.
- **Turn (02):** it is a planet, and the sea is draining off the beach — pulled toward it.
- **Peak (03):** under the planet the horizon swells into a wall of water 1 km high, and it starts coming.
- **Ending (04):** cut to black on the impact → the same shore, calm, an ordinary Moon. Title. (Echoes 01.)
- **Hook (0–3 s):** the arc on the horizon is already visible in 01 and wrong-sized from the first frame.
- **Native move at the peak:** the long-lens push — the camera's fov narrows while the planet grows, so the
  planet overfills the frame (megalophobia = scale with no edge).

## 3. Physics (Jupiter-mass rogue planet, M = 318 M⊕, R = 69 911 km)
Equilibrium tide h = 3/2 · (M/M⊕) · R⊕ · (R⊕/d)³ (the Moon gives 0.54 m — checks). Apparent size 2·atan(R/d).
With the planet on the horizon the viewer is 90° from the sub-planet point: local sea level **falls by h/2**
while the bulge (+h) stands under the planet.

| d (km) | Earth–Moon distances | apparent size | × Moon | tide h | in film |
|---:|---:|---:|---:|---:|---|
| 4 270 000 | 11.1 | 1.9° | 3.6 | 10 m | 01 start |
| 3 000 000 | 7.8 | 2.7° | 5.2 | 29 m | 01 → 02 |
| 2 000 000 | 5.2 | 4.0° | 7.7 | 98 m | 02 |
| 1 500 000 | 3.9 | 5.3° | 10.3 | 233 m | 02 → 03 |
| 923 000 | 2.4 | 8.7° | 16.7 | 1 000 m | 03 peak |
| 106 000 | 0.28 | 67° | 129 | 658 km | Roche limit: Earth is torn apart (end card) |

Dream time: the approach is compressed to 30 s (a real one would take days); the readout says so ("梦中时间").

## 4. Benchmark
- *Melancholia* (von Trier, 2011) and NASA/ESO sky visualisations. **Learn:** planet rising like a full moon
  at dusk, long-lens compression, silence before scale. **Don't take:** shots, designs, the blue planet.
- The planet is an original banded gas giant (cream/umber bands, a pale blue-grey storm), not Jupiter itself.

## 5. Clip list
| # | id | s | framing / camera | what happens | caption / readout | sound |
|---|----|---|------------------|--------------|----------------|-------|
| 1 | 01-shore | 7 | POV walking the wet sand, 35 mm, slow tilt up to the horizon | swash over sand, dusk; a pale arc on the horizon, too big | 我总是做同一个梦 / I keep having the same dream · readout fades in at 4 s | surf, wind, footsteps; a single low tone at the arc |
| 2 | 02-rise | 8 | tripod on the shore, 85 mm, slow push (fov narrows) | planet half-risen, lit full by the sun behind us; the waterline draws back across the sand, fish-scale glints | 海不是在退去，是被拉走 / The sea isn't leaving. It's being pulled. | surf fades out (near-silence 1), sucking drain, sub drone |
| 3 | 03-wall | 9 | 135 mm, low; slight shake from 5 s | planet overfills the frame; under it the horizon swells into a dark ridge, 1 km, and advances | 潮汐隆起 一千米 / Tidal bulge: 1 km · readout counts | rising roar, rumble; hard silence at 7.6 s (near-silence 2), cut to black |
| 4 | 04-wake | 6 | same framing as 01, still | calm shore, ordinary Moon; title | 巨物 · MEGALOPHOBIA (4 s) + physics line | first sound after the silence: one soft wave (J-cut from black) |

## 6. Beat sheet (key clip 03)
0.0 fade in on the planet filling 90% of the frame height · 1.0 caption · 2.0 the horizon line lifts under the
planet · 4.5 the ridge darkens, spray veil on its crest · 5.0 shake begins · 7.0 the ridge fills the lower
half · 7.6 sound cuts · 8.3 black.

## 7. Sound design
| section | ambience | foley | music state | silence? |
|---|---|---|---|---|
| 01 | surf + wind | footsteps in wet sand | one low tone at the arc | — |
| 02 | surf fading out | drain hiss as the water retreats | sub drone, slow swell | near-silence at 4–6 s |
| 03 | roar rising | spray, rumble, shake | braam at 2.0, riser to 7.6 | **hard cut to silence at 7.6** |
| 04 | one wave, soft wind | — | a single held note under the title | — |
J-cuts: the wave of 04 starts under black; the drone of 02 enters under the end of 01.

## 8. Type
Captions in the lower letterbox bar (style default): English Cinzel caps over 中文 (Noto Serif SC).
Physics readout: JetBrains Mono, small, top-left of the picture area, fades in like instrument data
(`距离 · 视直径 · 潮高`), counting smoothly; no boxes, no HUD chrome.
