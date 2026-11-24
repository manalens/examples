// A small static server for this example. No dependencies.
//
//   node serve.mjs          serve the pages on PORT (default 8080)
//   node serve.mjs --check  check that the integrity hash in the pages
//                           matches the SDK file, then exit
//
// It fills in %MANALENS_PUBLISHABLE_KEY% and %MANALENS_ENDPOINT% from the environment,
// and serves the snippet file from the installed @manalens/web
// package.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const pages = { '/': 'index.html', '/index.html': 'index.html', '/pricing.html': 'pricing.html' };
const snippetPath = fileURLToPath(import.meta.resolve('@manalens/web/snippet'));
const snippet = readFileSync(snippetPath);
const integrity = `sha384-${createHash('sha384').update(snippet).digest('base64')}`;

// Subresource Integrity: the hash in each page must match the file.
for (const file of new Set(Object.values(pages))) {
  const html = readFileSync(new URL(file, import.meta.url), 'utf8');
  const found = /integrity="([^"]+)"/.exec(html)?.[1];
  if (found !== integrity) {
    console.error(`${file}: integrity is ${found}, but the SDK file hash is ${integrity}. Update the page.`);
    process.exit(1);
  }
}
if (process.argv.includes('--check')) {
  console.log(`OK: the pages have the SDK file hash ${integrity}`);
  process.exit(0);
}

const publishableKey = process.env.MANALENS_PUBLISHABLE_KEY ?? '';
const endpoint = process.env.MANALENS_ENDPOINT ?? '';
if (!publishableKey || !endpoint) {
  console.error('Set MANALENS_PUBLISHABLE_KEY and MANALENS_ENDPOINT (copy .env.example to .env).');
  process.exit(1);
}
const escapeAttr = value => value.replace(/[&"<>]/g, c => `&#${c.charCodeAt(0)};`);

const port = Number(process.env.PORT || 8080);
createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (path === '/snippet.global.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' });
    res.end(snippet);
    return;
  }
  const file = pages[path];
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
    return;
  }
  const html = readFileSync(new URL(file, import.meta.url), 'utf8')
    .replaceAll('%MANALENS_PUBLISHABLE_KEY%', escapeAttr(publishableKey))
    .replaceAll('%MANALENS_ENDPOINT%', escapeAttr(endpoint));
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(port, () => {
  console.log(`Open http://localhost:${port}/ (or http://<your project domain>:${port}/ for a *.localhost project domain)`);
});
