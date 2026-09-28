// Film project model shared by every kit tool: find the film folder, read film.config.mjs, load clips in
// Node (same timeline.js the browser uses), lay the film out, find Chrome.
// CLI: node _kit/lib/film.mjs                 → film layout (id, start, duration)
//      node _kit/lib/film.mjs <id> <field>    → one clip field, e.g. `narration.zh`, `timing.sub.0`
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The film folder: the folder of the script that was run if it holds film.config.mjs (the film's own
// render.mjs wrappers), else the nearest folder up from cwd that does, else FILM_DIR.
function findRoot() {
  const has = (d) => d && fs.existsSync(path.join(d, 'film.config.mjs'));
  if (has(process.env.FILM_DIR)) return path.resolve(process.env.FILM_DIR);
  const script = process.argv[1] && path.dirname(fs.realpathSync(process.argv[1]));
  if (has(script)) return script;
  for (let d = process.cwd(); ; d = path.dirname(d)) { if (has(d)) return d; if (d === path.dirname(d)) break; }
  console.error('no film.config.mjs here or above (run inside a film folder, or set FILM_DIR)'); process.exit(1);
}
export const root = findRoot();
export const rel = (p) => path.join(root, p);

const DEFAULTS = {
  clipDir: 'clips', global: 'CLIP', param: 'clip', fallback: undefined,
  film: 'out/film.mp4', fps: 30, crf: 17,
  soundtrack: 'none',        // 'film': one track across the film · 'clip': music (+ voice) per clip · 'none'
  filmFadeOut: 2.4,          // film mode: seconds the whole-film track fades at the end
  narration: null,           // clip mode: { field, voice, rate, voices, window(T) → [start, end] }
};
export const config = { ...DEFAULTS, ...(await import(pathToFileURL(rel('film.config.mjs')).href)).default };

// Clip files: NN-*.js are the film, in order. _*.js are shared helpers, anything else is a dev clip.
export const clipIds = () => fs.readdirSync(rel(config.clipDir)).filter((f) => /^\d\d-.*\.js$/.test(f)).map((f) => f.slice(0, -3)).sort();

// A clip outside the browser, with the film's timeline.js merged in: { ...clip, timing: T, duration }.
export function loadClip(id) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(rel('timeline.js'), 'utf8'), { window });
  vm.runInNewContext(fs.readFileSync(rel(`${config.clipDir}/${id}.js`), 'utf8'), { window });
  const A = window[config.global];
  if (!A) throw new Error(`${config.clipDir}/${id}.js did not set window.${config.global}`);
  const T = window.TIMELINE(A);
  return { ...A, timing: T, duration: window.DURATION ? window.DURATION(A) : T.fade[1] };
}

// The film: clips in order, each starting where the last ended (the same rule compile uses).
export function film() {
  let at = 0;
  const clips = clipIds().map((id) => { const A = loadClip(id), s = { id, start: at, duration: A.duration, A }; at += A.duration; return s; });
  return { clips, scenes: clips, duration: at, start: (id) => clips.find((s) => s.id === id).start };
}

export function chrome() {
  const c = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && fs.existsSync(p));
  if (!c) { console.error('Chrome not found; set CHROME_PATH'); process.exit(1); }
  return c;
}

// extra query params (e.g. { samples: 16 } for cg-lab sub-frame accumulation); empty values are left out
export const engineUrl = (id, q = {}) => pathToFileURL(rel('engine.html')).href + `?record&clip=${encodeURIComponent(id)}`
  + Object.entries(q).filter(([, v]) => v != null && v !== '' && v !== false).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');

// Tiny argv helper: opt('fps', 30) reads --fps; positional() is everything that isn't a flag or a flag's value.
export function argv(list = process.argv.slice(2), flags = []) {
  const takes = (a) => a.startsWith('--') && !flags.includes(a.slice(2));
  return {
    has: (k) => list.includes(`--${k}`),
    opt: (k, d) => { const i = list.indexOf(`--${k}`); return i >= 0 ? list[i + 1] : d; },
    positional: () => list.filter((a, i) => !a.startsWith('--') && !(i > 0 && takes(list[i - 1]))),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, field] = process.argv.slice(2);
  if (!id) { const F = film(); F.clips.forEach((s) => console.log(`${s.id.padEnd(16)} ${s.start.toFixed(1).padStart(6)}s  +${s.duration}s`)); console.log(`total ${F.duration}s`); }
  else {
    const v = (field ?? '').split('.').filter(Boolean).reduce((o, k) => o?.[k], loadClip(id));
    if (v === undefined) { console.error(`no field ${field}`); process.exit(1); }
    console.log(typeof v === 'object' ? JSON.stringify(v) : v);
  }
}
