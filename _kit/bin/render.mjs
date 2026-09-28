// Renders one clip from engine.html frame by frame in headless Chrome → ffmpeg → MP4, then lays in the
// soundtrack (the film's config.soundtrack) unless --silent.
// Usage: node render.mjs <clip-id> [--fps 30] [--secs <duration>] [--out out/<id>.mp4] [--check] [--silent] [--samples N]
//   --samples N  sub-frames per frame (cg-lab accumulation: motion blur + AA); default config.samples
//   --check   only verify the CJK font covers every Han character the clip draws
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { root, config, chrome, engineUrl, argv, kitRoot } from '../lib/film.mjs';

const A = argv(undefined, ['check', 'silent']);
const [id] = A.positional();
if (!id) { console.error('usage: node render.mjs <clip-id> [--fps 30] [--secs S] [--out file] [--check] [--silent]'); process.exit(1); }
const fps = +A.opt('fps', config.fps);
const out = path.resolve(root, A.opt('out', `out/${id}.mp4`));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.setViewport({ width: 1920, height: 1080 });
await page.goto(engineUrl(id, { samples: A.opt('samples', config.samples) }));
await page.waitForFunction('window.sceneReady === true', { timeout: 60000 });

const missing = await page.evaluate(() => window.glyphCheck(window.clipHan()));
console.log(missing.length ? `MISSING GLYPHS: ${missing.join('')}` : 'glyph check: all Han characters covered');
if (A.has('check')) { await browser.close(); process.exit(missing.length ? 1 : 0); }

const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', String(config.crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });

const secs = +A.opt('secs', await page.evaluate(() => window.duration));
const frames = Math.round(secs * fps), t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const b64 = await page.evaluate((t) => {
    window.renderAt(t);
    return document.getElementById('cv').toDataURL('image/jpeg', 0.95).split(',')[1];
  }, i / fps);
  if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0) process.stdout.write(`\r${id}: frame ${i}/${frames}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`\n${id}: wrote ${path.relative(root, out)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (config.soundtrack !== 'none' && !A.has('silent') && !A.opt('out') && /^\d\d-/.test(id))
  execFileSync('node', [path.join(kitRoot, 'audio/mix.mjs'), id], { cwd: root, stdio: 'inherit', env: { ...process.env, FILM_DIR: root } });
