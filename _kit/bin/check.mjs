// Final QC on a rendered file (default: the film). Prints one short report; exits 1 on a hard failure.
// Usage: node check.mjs [file.mp4]
//   duration vs the film layout · loudness (EBU R128 integrated, true peak) · black frames · long silences
// Targets: −16 LUFS ±1, true peak ≤ −1 dBTP, no black frames (clips fade to the ground colour, never black).
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { root, config, film, argv } from '../lib/film.mjs';

const [f0] = argv().positional();
const file = path.resolve(root, f0 ?? config.film);
if (!fs.existsSync(file)) { console.error(`missing ${path.relative(root, file)}`); process.exit(1); }
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' }));
const dur = +probe.format.duration, v = probe.streams.find((s) => s.codec_type === 'video'), hasA = probe.streams.some((s) => s.codec_type === 'audio');
const bad = [], line = (k, s) => console.log(`${k.padEnd(10)} ${s}`);

const isFilm = !f0 || path.resolve(root, f0) === path.resolve(root, config.film);
const expect = isFilm ? film().duration : null;
line('file', `${path.relative(root, file)} · ${v.width}×${v.height} @ ${v.r_frame_rate} · ${dur.toFixed(2)} s${expect ? ` (layout ${expect.toFixed(2)} s)` : ''}`);
if (expect && Math.abs(dur - expect) > 0.25) bad.push(`duration off by ${(dur - expect).toFixed(2)} s`);

if (hasA) {
  const e = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const I = +e.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0], TP = +e.match(/Peak:\s+(-?[\d.]+) dBFS/g).pop().match(/-?[\d.]+/)[0];
  line('loudness', `${I} LUFS integrated, true peak ${TP} dBTP`);
  if (Math.abs(I + 16) > 1) bad.push(`loudness ${I} LUFS (target −16)`);
  if (TP > -1) bad.push(`true peak ${TP} dBTP (> −1)`);
  const s = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a', '-af', 'silencedetect=n=-50dB:d=1.5', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const sil = [...s.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_duration: ([\d.]+)/g)].map((m) => `${(+m[1]).toFixed(1)}s+${(+m[2]).toFixed(1)}`);
  line('silence', sil.length ? `${sil.length} gap(s) ≥1.5 s: ${sil.join(', ')} (intended?)` : 'none ≥1.5 s');
} else line('audio', 'none');

const b = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:v', '-vf', 'blackdetect=d=0.05:pix_th=0.08', '-an', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const black = [...b.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${(+m[1]).toFixed(2)}–${(+m[2]).toFixed(2)}s`);
line('black', black.length ? black.join(', ') + (config.blackGround ? ' (black ground: fades, check they are intended)' : '') : 'none');
// config.blackGround: the style's ground is black (cg-lab), so its fades read as black frames: report, don't fail
if (black.length && !config.blackGround) bad.push(`${black.length} black segment(s)`);

console.log(bad.length ? `FAIL: ${bad.join('; ')}` : 'OK');
process.exit(bad.length ? 1 : 0);
