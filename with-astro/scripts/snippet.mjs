// Copy the web SDK snippet file to public/ and check its hash.
//
//   node scripts/snippet.mjs          check the hash, then copy the file
//   node scripts/snippet.mjs --check  check the hash only
//
// The Base layout loads /snippet.global.js with the integrity value from
// src/config.ts (Subresource Integrity). The browser refuses the file when
// the two do not match, so this script fails first.
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const snippetPath = fileURLToPath(import.meta.resolve('@manalens/web/snippet'));
const integrity = `sha384-${createHash('sha384').update(readFileSync(snippetPath)).digest('base64')}`;

const configPath = new URL('../src/config.ts', import.meta.url);
const found = /MANALENS_SNIPPET_INTEGRITY = '([^']+)'/.exec(readFileSync(configPath, 'utf8'))?.[1];
if (found !== integrity) {
  console.error(`src/config.ts: MANALENS_SNIPPET_INTEGRITY is ${found}, but the SDK file hash is ${integrity}. Update src/config.ts.`);
  process.exit(1);
}
if (process.argv.includes('--check')) {
  console.log(`OK: src/config.ts has the SDK file hash ${integrity}`);
  process.exit(0);
}
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
copyFileSync(snippetPath, new URL('../public/snippet.global.js', import.meta.url));
console.log('Copied the SDK snippet to public/snippet.global.js');
