// Prepare the static site uploaded by Cloudflare Workers Builds.
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');

execFileSync(process.execPath, ['tools/build_data.mjs'], { cwd: root, stdio: 'inherit' });

// Only clear the generated dist directory in this checkout.
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const file of ['index.html', 'LICENSE']) {
  copyFileSync(path.join(root, file), path.join(output, file));
}
for (const directory of ['assets', 'css', 'data', 'js', 'vendor']) {
  cpSync(path.join(root, directory), path.join(output, directory), { recursive: true });
}

console.log('Cloudflare static site ready at dist/index.html');
