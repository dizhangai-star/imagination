// Narration via edge-tts (free Microsoft Edge voices; runs through `uvx` if edge-tts isn't installed).
// Usage: node _kit/audio/narrate.mjs <clip-id> [voice]    → audio/build/<id>-voice.wav (48 kHz mono, silence trimmed)
//        node _kit/audio/narrate.mjs --samples [clip-id] → audio/samples/<voice>.mp3, one per config.narration.voices
// Config (film.config.mjs): narration: { field: 'narration.zh', voice, rate: '-10%', voices: [...], window: (T) => [start, end] }
// A clip may set its own `voice`. Warns when the speech overruns the window (the subtitle's on-screen time).
// Note: edge-tts uses Microsoft's service unofficially. For published or commercial films, switch to Azure
// Speech (same voices, licensed) or a local model; only speak() changes.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { loadClip, config, rel, argv } from '../lib/film.mjs';

const N = config.narration;
if (!N) { console.error('film.config.mjs has no narration block'); process.exit(1); }
const A = argv(undefined, ['samples']);
const [id0, voiceArg] = A.positional();
const has = (c) => spawnSync('sh', ['-c', `command -v ${c}`]).status === 0;
const TTS = has('edge-tts') ? ['edge-tts'] : ['uvx', 'edge-tts'];
const speak = (text, voice, out) => execFileSync(TTS[0], [...TTS.slice(1), '--voice', voice, `--rate=${N.rate ?? '+0%'}`, '--text', text, '--write-media', out], { stdio: ['ignore', 'ignore', 'ignore'] });
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' });
const text = (C) => N.field.split('.').reduce((o, k) => o?.[k], C);

if (A.has('samples')) {
  const C = loadClip(id0 ?? N.sampleClip);
  fs.mkdirSync(rel('audio/samples'), { recursive: true });
  for (const v of N.voices ?? [N.voice]) {
    const f = rel(`audio/samples/${v}.mp3`);
    speak(text(C), v, f);
    console.log(`${v.padEnd(24)} ${dur(f).toFixed(2)}s  audio/samples/${v}.mp3`);
  }
  process.exit(0);
}

if (!id0) { console.error('usage: node narrate.mjs <clip-id> [voice] | --samples [clip-id]'); process.exit(1); }
const C = loadClip(id0), voice = voiceArg ?? C.voice ?? N.voice;
const mp3 = rel(`audio/build/${id0}-voice.mp3`), out = rel(`audio/build/${id0}-voice.wav`);
fs.mkdirSync(rel('audio/build'), { recursive: true });
speak(text(C), voice, mp3);
// edge-tts pads ~0.2 s before and ~0.8 s after the speech; trim both so timing is exact
const trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03';
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-af', `${trim},areverse,${trim},areverse,aresample=48000`, '-ac', '1', out]);
fs.rmSync(mp3);
const d = dur(out), [w0, w1] = N.window ? N.window(C.timing) : [0, C.duration];
console.log(`${id0}: ${voice}, ${d.toFixed(2)}s of speech (window ${(w1 - w0).toFixed(2)}s) → audio/build/${id0}-voice.wav`);
if (d > w1 - w0) console.error('WARNING: narration overruns its window; shorten the text or widen the timing');
