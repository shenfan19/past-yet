// The interface must not run the engine. Only js/backend.js may import js/sim.js. Usage: node tools/check_boundary.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'js');
const allowed = new Set(['backend.js', 'sim.js', 'expr.js', 'rng.js', 'scene_core.js']);
let bad = 0;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  if (allowed.has(f)) continue;
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  if (/from '\.\/(sim|expr|rng|scene_core)\.js'/.test(src)) { console.log(`${f} imports the engine, go through backend.js`); bad++; }
}
console.log(bad ? `${bad} files cross the boundary` : 'the interface stays on its side of backend.js');
process.exit(bad ? 1 : 0);
