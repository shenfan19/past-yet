// Builds play.html: the whole game in one page that opens with a double click, no server. The modules are bundled into one inline
// script, every file under data/ and the music are carried inline, and the page keeps the styles, icon and portraits by their
// relative paths, so play.html has to stay in the root of the game folder. Usage: node tools/build_offline.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = Object.fromEntries(walk(path.join(root, 'data')).map((f) => [rel(f), fs.readFileSync(f, 'utf8')]));
const musicDir = path.join(root, 'assets/music');
const music = Object.fromEntries(fs.readdirSync(musicDir).filter((f) => f.endsWith('.mid')).map((f) => [f, fs.readFileSync(path.join(musicDir, f)).toString('base64')]));
// esbuild is fetched by npx at a fixed version on first use and only joins the modules; the game itself has no build step
const bundle = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', 'esbuild@0.24.0', 'js/main.js', '--bundle', '--format=esm', '--log-level=warning'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' });
// nothing inline may close the script tag early
const safe = (s) => s.replace(/<\/(script)/gi, '<\/$1');
const yaml = fs.readFileSync(path.join(root, 'vendor/js-yaml.min.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const yamlTag = '<script src="vendor/js-yaml.min.js"></script>';
const mainTag = '<script type="module" src="js/main.js"></script>';
if (!html.includes(yamlTag) || !html.includes(mainTag)) throw new Error('index.html no longer has the two script tags play.html replaces');
html = html.replace(yamlTag, () => `<script>${safe(yaml)}</script>`)
  .replace(mainTag, () => `<script>window.TP_FILES = ${safe(JSON.stringify(files))};\nwindow.TP_MUSIC = ${safe(JSON.stringify(music))};</script>\n<script type="module">${safe(bundle)}</script>`);
fs.writeFileSync(path.join(root, 'play.html'), html);
console.log(`play.html: ${Object.keys(files).length} data files, ${Object.keys(music).length} tracks, ${(html.length / 1048576).toFixed(1)} MB`);
