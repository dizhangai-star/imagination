// Shows (and with --yes deletes) what a film folder can safely lose. Dry run by default.
// Usage: node clean.mjs [--frames] [--drafts] [--cache] [--yes]     (no category flag = report all)
//   --frames  frames/*            review PNGs (preview.mjs rewrites them in seconds)
//   --drafts  out/*.mp4 that aren't a current clip render or the film (old sprint drafts, test renders)
//   --cache   audio/build/* except narration (*-voice.wav costs a network call to redo)
// Never touches source, the film, current clip renders, narration or audio/samples.
import fs from 'node:fs';
import path from 'node:path';
import { root, rel, config, clipIds, argv } from '../lib/film.mjs';

const A = argv(undefined, ['frames', 'drafts', 'cache', 'yes']);
const all = !['frames', 'drafts', 'cache'].some((k) => A.has(k));
const size = (f) => { const s = fs.statSync(f); return s.isDirectory() ? fs.readdirSync(f).reduce((n, g) => n + size(path.join(f, g)), 0) : s.size; };
const ls = (d) => (fs.existsSync(rel(d)) ? fs.readdirSync(rel(d)).filter((f) => f !== '.DS_Store').map((f) => rel(`${d}/${f}`)) : []);
const keepOut = new Set([...clipIds().map((id) => rel(`out/${id}.mp4`)), path.resolve(root, config.film), path.resolve(root, config.film.replace(/\.mp4$/, '.srt'))]);
const groups = {
  frames: ls('frames'),
  drafts: ls('out').filter((f) => f.endsWith('.mp4') && !keepOut.has(f)),
  cache: ls('audio/build').filter((f) => !/-voice\.wav$/.test(f)),
};
let total = 0;
for (const [k, files] of Object.entries(groups)) {
  if (!all && !A.has(k)) continue;
  const n = files.reduce((s, f) => s + size(f), 0); total += n;
  console.log(`${k.padEnd(7)} ${(n / 1e6).toFixed(1).padStart(7)} MB  ${files.length} file(s)${k === 'drafts' && files.length ? ': ' + files.map((f) => path.basename(f)).join(', ') : ''}`);
  if (A.has('yes')) files.forEach((f) => fs.rmSync(f, { recursive: true, force: true }));
}
console.log(A.has('yes') ? `deleted ${(total / 1e6).toFixed(1)} MB` : `${(total / 1e6).toFixed(1)} MB reclaimable (dry run; add --yes to delete)`);
