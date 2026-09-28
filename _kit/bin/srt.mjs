// Exports the film's subtitles as .srt, from each clip's text and its timeline (no re-typing).
// Usage: node srt.mjs [--out out/<film>.srt]
// film.config.mjs: subtitles: (A, T) => [[t0, t1, text], …]   (times within the clip; text may hold '\n')
import fs from 'node:fs';
import path from 'node:path';
import { root, config, film, argv } from '../lib/film.mjs';

if (!config.subtitles) { console.error('film.config.mjs has no subtitles(A, T) function'); process.exit(1); }
const out = path.resolve(root, argv().opt('out', config.film.replace(/\.mp4$/, '.srt')));
const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const cues = film().clips.flatMap((c) => (config.subtitles(c.A, c.A.timing) ?? []).map(([a, b, text]) => [c.start + a, c.start + b, text])).filter((c) => c[2]);
fs.writeFileSync(out, cues.map(([a, b, text], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${text}\n`).join('\n'));
const short = cues.filter(([a, b]) => b - a < 1.8).length;
console.log(`${cues.length} subtitles → ${path.relative(root, out)}${short ? ` (${short} shorter than 1.8 s)` : ''}`);
