// Puts the soundtrack under the picture (the video stream is copied, never re-encoded).
// Two modes, from film.config.mjs `soundtrack`:
//
//  'clip'  node mix.mjs <id> [--voice <name>] [--fresh]          (chinese-zodiac)
//          Music is rebuilt every run by the film's `audio/music.mjs <id> --secs S` → audio/build/<id>-music.wav.
//          With config.narration, the voice (audio/build/<id>-voice.wav, fetched by narrate.mjs only when
//          missing, or with --fresh / --voice) gets HPF 90 + presence + 3:1 compression, starts at timing.voice,
//          and ducks the music (sidechain ≈4 dB). Fade with the picture → two-pass loudnorm −16 LUFS / −1.5 dBTP → AAC.
//
//  'film'  node mix.mjs film | <id>                               (baby-leyi)
//          One unbroken track: the film's `audio/music.mjs` → audio/build/film.wav, loudness-normalized once to
//          audio/build/film-norm.wav (rebuilt when any clip, the engine or audio code is newer). `film` muxes it
//          into config.film; <id> muxes that clip's slice into out/<id>.mp4 for review, so levels match the film.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { root, rel, config, film, loadClip, argv, kitRoot } from '../lib/film.mjs';

const A = argv(undefined, ['fresh']);
const [id] = A.positional();
if (!id) { console.error('usage: node mix.mjs <clip-id> | film'); process.exit(1); }
const run = (cmd, a) => execFileSync(cmd, a, { cwd: root, stdio: 'inherit', env: { ...process.env, FILM_DIR: root } });
const LN = 'loudnorm=I=-16:TP=-1.5:LRA=11';
const measure = (inputs, pre) => {
  const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inputs, pre[0], `${pre[1]}${LN}:print_format=json`, '-vn', '-f', 'null', '-'], { cwd: root, encoding: 'utf8' });
  const j = p.stderr.lastIndexOf('{');
  return JSON.parse(p.stderr.slice(j, p.stderr.indexOf('}', j) + 1));
};
const apply = (m) => `${LN}:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;

if (config.soundtrack === 'clip') {
  const T = loadClip(id).timing, end = T.fade[1];
  const video = rel(`out/${id}.mp4`), music = rel(`audio/build/${id}-music.wav`), voice = rel(`audio/build/${id}-voice.wav`);
  if (!fs.existsSync(video)) { console.error(`missing out/${id}.mp4; run: node render.mjs ${id}`); process.exit(1); }
  run('node', ['audio/music.mjs', id, '--secs', String(end)]);
  const N = config.narration;
  if (N && (!fs.existsSync(voice) || A.has('fresh') || A.opt('voice'))) run('node', [path.join(kitRoot, 'audio/narrate.mjs'), id, ...(A.opt('voice') ? [A.opt('voice')] : [])]);
  let graph, inputs;
  if (N) {
    const ms = Math.round(T.voice * 1000);
    graph = [
      `[2:a]aformat=sample_rates=48000:channel_layouts=mono,highpass=f=90,equalizer=f=3500:t=q:w=1:g=2,` +
        `acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=2,pan=stereo|c0=c0|c1=c0,` +
        `adelay=${ms}|${ms},apad,volume=1dB,asplit[v][key]`,
      `[1:a]volume=-3dB[m]`,
      `[m][key]sidechaincompress=threshold=0.08:ratio=2:attack=40:release=700:knee=4[bed]`,
      `[bed][v]amix=inputs=2:normalize=0,atrim=0:${end},afade=t=out:st=${T.fade[0]}:d=${(end - T.fade[0]).toFixed(2)}`,
    ].join(';');
    inputs = ['-i', video, '-i', music, '-i', voice];
  } else {
    graph = `[1:a]atrim=0:${end},afade=t=out:st=${T.fade[0]}:d=${(end - T.fade[0]).toFixed(2)}`;
    inputs = ['-i', video, '-i', music];
  }
  const m = measure(inputs, ['-filter_complex', `${graph},`]);
  const tmp = rel(`out/.${id}.mix.mp4`);
  run('ffmpeg', ['-y', '-v', 'error', ...inputs, '-filter_complex', `${graph},${apply(m)},aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(end), '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, video);
  console.log(`${id}: mixed (in ${m.input_i} LUFS → −16${N ? `, voice at ${T.voice.toFixed(2)}s` : ''}) → out/${id}.mp4`);
} else if (config.soundtrack === 'film') {
  const F = film(), norm = 'audio/build/film-norm.wav';
  const mt = (p) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
  const deps = [rel('engine.html'), rel('timeline.js'), ...fs.readdirSync(rel('audio')).filter((f) => f.endsWith('.mjs')).map((f) => rel(`audio/${f}`)),
    ...fs.readdirSync(rel(config.clipDir)).map((f) => rel(`${config.clipDir}/${f}`)), ...['dsp', 'sfx', 'cues'].map((f) => path.join(kitRoot, `audio/${f}.mjs`))];
  if (Math.max(...deps.map(mt)) > mt(rel(norm))) {
    run('node', ['audio/music.mjs']);
    const m = measure(['-i', rel('audio/build/film.wav')], ['-af', '']);
    run('ffmpeg', ['-y', '-v', 'error', '-i', rel('audio/build/film.wav'), '-af', `${apply(m)},aresample=48000`, '-c:a', 'pcm_s16le', rel(norm)]);
    console.log(`film track: ${m.input_i} LUFS → −16 → ${norm}`);
  }
  const s = id === 'film' ? { start: 0, duration: F.duration } : F.clips.find((c) => c.id === id);
  if (!s) { console.error(`${id} is not a film clip (${config.clipDir}/NN-*.js)`); process.exit(1); }
  const video = id === 'film' ? path.resolve(root, config.film) : rel(`out/${id}.mp4`), tmp = video.replace(/([^/]+)$/, '.$1.mix.mp4');
  if (!fs.existsSync(video)) { console.error(`missing ${path.relative(root, video)}`); process.exit(1); }
  // a lone clip fades its slice in and out with the picture; the film keeps the track whole (tail fades at the end)
  const d = s.duration, fo = config.filmFadeOut;
  const af = id === 'film' ? `afade=t=out:st=${d - fo}:d=${fo}` : `afade=t=in:d=0.25,afade=t=out:st=${d - 0.45}:d=0.45`;
  run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-ss', String(s.start), '-t', String(d), '-i', rel(norm),
    '-map', '0:v', '-map', '1:a', '-af', af, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(d), '-movflags', '+faststart', tmp]);
  fs.renameSync(tmp, video);
  console.log(`${id}: sound ${s.start.toFixed(2)}–${(s.start + d).toFixed(2)}s → ${path.relative(root, video)}`);
} else console.log(`soundtrack is '${config.soundtrack}': nothing to mix`);
