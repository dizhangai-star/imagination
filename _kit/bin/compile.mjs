// Joins every rendered film clip (<clipDir>/NN-*.js, in order) into the film (config.film).
// Usage: node compile.mjs [--out out/film.mp4] [--silent]
// Each clip starts and ends on the same bare ground, so plain cuts are seamless. Uses the concat filter
// (re-encode) rather than stream copy: no timestamp drift or AAC priming gaps at the joins.
//   soundtrack 'film': picture only, then the whole-film track goes on in one piece (audio/mix.mjs film)
//   soundtrack 'clip': each clip's own sound is concatenated with its picture
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { root, config, clipIds, argv, kitRoot } from '../lib/film.mjs';

const A = argv(undefined, ['silent']);
const out = path.resolve(root, A.opt('out', config.film));
const ids = clipIds();
const clips = ids.map((id) => path.join(root, 'out', `${id}.mp4`));
const missing = ids.filter((id, k) => !fs.existsSync(clips[k]));
if (missing.length) { console.error(`missing renders: ${missing.join(', ')} (node render.mjs <id>)`); process.exit(1); }

const withAudio = config.soundtrack === 'clip';
const tmp = path.join(path.dirname(out), `.${path.basename(out)}`);
execFileSync('ffmpeg', ['-y', '-v', 'error', ...clips.flatMap((c) => ['-i', c]),
  '-filter_complex', `${clips.map((_, k) => (withAudio ? `[${k}:v][${k}:a]` : `[${k}:v]`)).join('')}concat=n=${clips.length}:v=1:a=${withAudio ? 1 : 0}${withAudio ? '[v][a]' : '[v]'}`,
  '-map', '[v]', ...(withAudio ? ['-map', '[a]'] : []), '-c:v', 'libx264', '-preset', 'medium', '-crf', String(config.crf), '-pix_fmt', 'yuv420p',
  ...(withAudio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : []), '-movflags', '+faststart', tmp], { stdio: 'inherit' });
fs.renameSync(tmp, out);
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
console.log(`${ids.length} clips (${ids.join(' ')}) → ${path.relative(root, out)}, ${(+dur).toFixed(1)} s`);
if (config.soundtrack === 'film' && !A.has('silent') && !A.opt('out'))
  execFileSync('node', [path.join(kitRoot, 'audio/mix.mjs'), 'film'], { cwd: root, stdio: 'inherit', env: { ...process.env, FILM_DIR: root } });
