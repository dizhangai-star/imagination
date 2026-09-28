// Scaffolds a new film folder from a style template: engine, timeline, config, a demo clip, starter music,
// render/preview/compile wrappers, CLAUDE.md, PROGRESS.md, TREATMENT.md.
// Usage: node _kit/bin/new-film.mjs <name> --style paper-cut|ink-wash [--title "…"] [--seal 印章] [--dir <parent>]
//   <name>  lowercase-hyphen folder name (no spaces, # or %: ffmpeg paths). Parent defaults to the folder
//           holding _kit (videos/), so engine.html can load ../_kit/… with plain relative paths.
// Then: cd <name> && node preview.mjs 00-title --every 1   (renders the demo clip as a grid)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const name = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const styles = fs.readdirSync(path.join(kit, 'styles')).filter((s) => fs.existsSync(path.join(kit, 'styles', s, 'template')));
const style = opt('style');
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name) || !styles.includes(style)) {
  console.error(`usage: node new-film.mjs <lowercase-name> --style ${styles.join('|')} [--title "…"] [--seal 印章] [--dir <parent>]`); process.exit(1);
}
const dest = path.resolve(opt('dir', path.dirname(kit)), name);
if (fs.existsSync(dest)) { console.error(`${dest} already exists`); process.exit(1); }
const vars = { NAME: name, TITLE: opt('title', name), STYLE: style, SEAL: opt('seal', '印章'), DATE: new Date().toISOString().slice(0, 10) };

const made = [];
function copy(src, to) {
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(to, f === 'gitignore' ? '.gitignore' : f);
    if (fs.statSync(s).isDirectory()) { fs.mkdirSync(d, { recursive: true }); copy(s, d); continue; }
    // {{KIT}} is the kit's path relative to the file being written (engine.html → ../_kit, audio/x.mjs → ../../_kit)
    const KIT = path.relative(path.dirname(d), kit).split(path.sep).join('/');
    let text = fs.readFileSync(s, 'utf8').replaceAll('{{KIT}}', KIT);
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{{${k}}}`, v);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.writeFileSync(d, text); made.push(path.relative(dest, d));
  }
}
fs.mkdirSync(dest, { recursive: true });
copy(path.join(kit, 'templates/common'), dest);
copy(path.join(kit, 'styles', style, 'template'), dest);
['out', 'frames'].forEach((d) => fs.mkdirSync(path.join(dest, d), { recursive: true }));
console.log(`${name} (${style}) → ${dest}\n  ${made.sort().join('\n  ')}\nnext: cd ${path.relative(process.cwd(), dest) || '.'} && node preview.mjs 00-title --every 1`);
