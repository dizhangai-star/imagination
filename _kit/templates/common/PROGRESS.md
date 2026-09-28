# {{TITLE}}: Progress

**Resume here:** read this file (and `TREATMENT.md`), then continue from **Next step**.

## Next step
Sprint 0: write `TREATMENT.md` with the user's brief, then prove the look (style frames / model sheet) with the real code.

## Decisions (locked)
- **Style:** {{STYLE}} (`{{KIT}}/styles/{{STYLE}}/STYLE.md`)
- **Format:** 16:9, 1920×1080, 30 fps, <length> s, <n> clips
- **Language / captions:** <e.g. bilingual 繁體中文 above, English below>
- **Fonts:** <from the style defaults or changed>
- **Audio:** <soundtrack mode: film / clip; music idea; narration voice or none>
- **Art:** all drawn in code, no image models

## Sprints
- [ ] **0 · Brief + treatment + look**: `TREATMENT.md`, style frame(s) with the real engine → user approval
- [ ] **1 · Characters / props** (if any): model sheet → approval
- [ ] **2 · Clips A**: …
- [ ] **3 · Clips B**: …
- [ ] **4 · Audio**: music + SFX (+ narration) → approval
- [ ] **5 · Polish + final**: `node compile.mjs`, `check.mjs`, `srt.mjs` → the film

## How it works
- `engine.html?clip=<id>` loads `<clipDir>/<id>.js`; `window.renderAt(t)` draws frame t. Timing in `timeline.js`.
- Film-specific helpers and conventions: …

## Notes
- …
