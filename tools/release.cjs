// Release step: bump the version in the config, put a changelog entry on top, rebuild. Usage: node tools/release.cjs <version> "<entry line>" ["<entry line>" ...]
const fs = require('fs');
const { execSync } = require('child_process');
const [ver, ...lines] = process.argv.slice(2);
if (!ver || !lines.length) throw new Error('usage: version and at least one line');
const ed = (p, f) => { let s = fs.readFileSync(p, 'utf8'); const crlf = s.includes('\r\n'); if (crlf) s = s.replace(/\r\n/g, '\n'); s = f(s); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
ed('cards/config/config.yaml', (s) => { const n = s.replace(/^  version: [0-9.]+$/m, `  version: ${ver}`); if (n === s) throw new Error('version'); return n; });
const today = new Date().toISOString().slice(0, 10);
ed('CHANGELOG.md', (s) => s.replace('# Changelog\n\n', `# Changelog\n\n## ${ver}, ${today}\n\n${lines.map((l) => '- ' + l).join('\n')}\n\n`));
execSync('node tools/build_data.mjs', { stdio: 'ignore' });
// the page that opens with a double click, without a server, is built from the same data
execSync('node tools/build_offline.mjs', { stdio: 'ignore' });
// a release does not go out with placeholders that differ between languages
const i18n = execSync('node tools/check_i18n.mjs', { encoding: 'utf8' });
const bad = i18n.split(/\r?\n/).filter((l) => /placeholders differ/i.test(l));
if (bad.length) { console.log(bad.join('\n')); throw new Error('check_i18n'); }
console.log('version', ver);
