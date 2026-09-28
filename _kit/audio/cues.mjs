// Scans each film clip in headless Chrome and records when things start moving (the style's cue(kind, t0):
// paper-cut rise / pop / hang / confetti), so SFX land on the picture without hand-timing every piece.
// Usage: node _kit/audio/cues.mjs [--force]  → audio/build/cues.json  { id: { mtime, cues: [[t, kind, count], …] } }
// Only clips whose file (or the engine, timeline, _helpers or style pack) changed since the last scan are rescanned.
// Import it (import cues from '…/_kit/audio/cues.mjs') and the scan runs first.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { film, rel, config, chrome, engineUrl, kitRoot } from '../lib/film.mjs';

const FPS = 15, out = rel('audio/build/cues.json');
const cache = fs.existsSync(out) && !process.argv.includes('--force') ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const mt = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
const helpers = fs.readdirSync(rel(config.clipDir)).filter((f) => f.startsWith('_')).map((f) => rel(`${config.clipDir}/${f}`));
const shared = Math.max(mt(rel('engine.html')), mt(rel('timeline.js')), ...helpers.map(mt),
  ...fs.readdirSync(path.join(kitRoot, 'styles')).map((s) => mt(path.join(kitRoot, 'styles', s, 'style.js'))));
const todo = film().clips.filter((s) => !(cache[s.id]?.mtime >= Math.max(shared, mt(rel(`${config.clipDir}/${s.id}.js`)))));

for (const s of todo) {
  // a fresh browser per clip: after ~5 heavy scans one Chrome stalls on the next navigation
  const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.goto(engineUrl(s.id), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.sceneReady === true', { timeout: 90000 });
  const raw = await page.evaluate((n, fps) => {
    window.__cues = new Map();
    for (let i = 0; i < n; i++) { window.__t = i / fps; window.renderAt(i / fps); }
    return [...window.__cues];
  }, Math.round(s.duration * FPS), FPS);
  await browser.close();
  // keep real starts: inside the clip, and asked for before (or right as) they begin — a t0 derived from t
  // (seen only after its own start) is a continuous animation, not an event
  const pts = raw.map(([k, seen]) => { const [kind, t0] = k.split('@'); return [+t0, kind, seen]; })
    .filter(([t0, , seen]) => t0 >= 0.15 && t0 < s.duration - 0.5 && seen <= t0 + 0.1).sort((a, b) => a[0] - b[0]);
  // merge same-kind starts within 90 ms into one cue with a count
  const cues = [];
  for (const [t0, kind] of pts) {
    const c = cues.findLast((c) => c[1] === kind);
    if (c && t0 - c[0] < 0.09) c[2]++; else cues.push([t0, kind, 1]);
  }
  cache[s.id] = { mtime: Date.now(), cues: cues.sort((a, b) => a[0] - b[0]) };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cache));
  console.log(`${s.id}: ${cues.length} cues`);
}
export default cache;
