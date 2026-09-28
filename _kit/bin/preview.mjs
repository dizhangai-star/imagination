// Renders frames to one PNG grid without a video render (~3 s). The cheap way to review: look at a
// grid of small frames first, zoom (--crop) only where something looks wrong.
// Usage: node preview.mjs <clip-id> <t1> [t2 …] [--every S] [--crop x,y,w,h] [--cols 3] [--w 640] [--out frames/<id>-strip.png]
//        node preview.mjs film [--at 0.5] [--cols 4] [--w 480]   → one frame per film clip (contact sheet)
//   --every S   frames every S seconds across the clip (instead of listing times)
//   --crop      logical 640×360 units, e.g. --crop 300,180,200,120 to zoom on a head
//   --at        film sheet: where in each clip, as a fraction of its duration (default 0.5)
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';
import { root, chrome, engineUrl, argv, clipIds } from '../lib/film.mjs';

const A = argv();
const crop = A.opt('crop', '0,0,640,360').split(',').map(Number);
const [id, ...times] = A.positional();
if (!id) { console.error('usage: node preview.mjs <clip-id> <t…> | --every S | film'); process.exit(1); }
const sheet = id === 'film';
const cols = +A.opt('cols', sheet ? 4 : 3), cw = +A.opt('w', sheet ? 480 : 640);
const out = path.resolve(root, A.opt('out', `frames/${id}-${sheet ? 'sheet' : 'strip'}.png`));

const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => console.log('page:', m.text()));
const open = async (clip) => { await page.goto(engineUrl(clip, { samples: A.opt('samples') })); await page.waitForFunction('window.sceneReady === true', { timeout: 60000 }); };

// cells: [{ clip, t, label }]
let cells;
if (sheet) cells = clipIds().map((c) => ({ clip: c, frac: +A.opt('at', 0.5) }));
else {
  await open(id);
  const d = await page.evaluate(() => window.duration), step = A.opt('every');
  const ts = step ? Array.from({ length: Math.floor(d / +step) + 1 }, (_, i) => +(i * +step).toFixed(2)).filter((t) => t < d) : times.map(Number);
  cells = ts.map((t) => ({ clip: id, t }));
}

const shots = [];
for (const c of cells) {
  if (sheet) { await open(c.clip); c.t = +((await page.evaluate(() => window.duration)) * c.frac).toFixed(2); }
  shots.push(await page.evaluate((t, crop, cw, label) => {
    window.renderAt(t);
    const [cx, cy, w, h] = crop.map((v) => v * 3), ch = Math.round((cw * h) / w);
    const g = document.createElement('canvas'); g.width = cw; g.height = ch;
    const c = g.getContext('2d');
    c.drawImage(document.getElementById('cv'), cx, cy, w, h, 0, 0, cw, ch);
    c.font = '18px sans-serif'; c.fillStyle = '#b8322a'; c.fillText(label, 8, 22);
    return g.toDataURL('image/png');
  }, c.t, crop, cw, sheet ? `${c.clip} ${c.t}s` : `${c.t}s`));
}

// tile
await page.goto('about:blank');
const png = await page.evaluate(async (shots, cols) => {
  const imgs = await Promise.all(shots.map((s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; })));
  const cw = imgs[0].width, ch = imgs[0].height, g = document.createElement('canvas');
  g.width = cw * Math.min(cols, imgs.length); g.height = ch * Math.ceil(imgs.length / cols);
  const c = g.getContext('2d');
  imgs.forEach((im, i) => c.drawImage(im, (i % cols) * cw, Math.floor(i / cols) * ch));
  return g.toDataURL('image/png').split(',')[1];
}, shots, cols);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(png, 'base64'));
await browser.close();
console.log(`wrote ${path.relative(root, out)} (${shots.length} frames)`);
