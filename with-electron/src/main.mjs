// @ts-check
// Electron main process.
//
// The renderer page is served from https://<MANALENS_RENDERER_HOST>/ through a
// protocol handler, not from file://. The collector accepts a web event only
// when its page URL is an http(s) URL on the project domain, so a file:// page
// cannot send events. The handler serves the local files under that URL; the
// app needs no web server and no network for its own files.
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MainAnalytics, platformFromOS } from './main-analytics.mjs';

// Local runs read .env. A packaged build has no .env: put the Publishable key
// and the endpoint in your build config instead. The Publishable key is
// public by design; never ship a Secret key or an API key.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const publishableKey = process.env.MANALENS_PUBLISHABLE_KEY ?? '';
const endpoint = process.env.MANALENS_ENDPOINT ?? '';
const rendererHost = process.env.MANALENS_RENDERER_HOST || 'game.localhost';
if (!publishableKey || !endpoint) {
  console.error('Set MANALENS_PUBLISHABLE_KEY and MANALENS_ENDPOINT (copy .env.example to .env).');
  process.exit(1);
}
if (publishableKey.startsWith('mana_sk_') || publishableKey.startsWith('mana_api_')) {
  console.error('MANALENS_PUBLISHABLE_KEY must be the Publishable key (mana_pk_...). Never put a Secret key or an API key in an Electron app.');
  process.exit(1);
}

/** @type {NonNullable<import('./main-analytics.mjs').MainAnalyticsOptions['app']['storefront']>} */
const storefront = /** @type {any} */ (process.env.MANALENS_STOREFRONT || 'steam');
const appInfo = {
  platform: platformFromOS(process.platform),
  storefront,
  app_version: app.getVersion(),
  build: process.env.MANALENS_BUILD || '1',
  engine: /** @type {const} */ ('other'),
};

const analytics = new MainAnalytics({
  publishableKey,
  endpoint,
  userDataDir: app.getPath('userData'),
  app: appInfo,
  debug: process.env.MANALENS_DEBUG === 'true',
});

const rendererDir = fileURLToPath(new URL('./renderer/', import.meta.url));
const webSdkDir = fileURLToPath(new URL('.', import.meta.resolve('@manalens/web')));
/** @type {Record<string, string>} */
const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

/**
 * A file under dir, or undefined when the path leaves dir.
 * @param {string} dir
 * @param {string} path
 */
function fileIn(dir, path) {
  const file = normalize(join(dir, path));
  return file.startsWith(dir.endsWith(sep) ? dir : dir + sep) ? file : undefined;
}

/** @param {string} pathname */
function localFile(pathname) {
  // /lib/manalens-web/* is the web SDK build from node_modules. With a bundler
  // (Vite, electron-vite, webpack) you import '@manalens/web' instead.
  if (pathname.startsWith('/lib/manalens-web/')) return fileIn(webSdkDir, pathname.slice('/lib/manalens-web/'.length));
  return fileIn(rendererDir, pathname === '/' ? 'index.html' : pathname.slice(1));
}

app.whenReady().then(() => {
  const endpointOrigin = new URL(endpoint).origin;
  protocol.handle('https', request => {
    const url = new URL(request.url);
    // Every other https request (a hosted collector, for example) goes out as usual.
    if (url.hostname !== rendererHost) return net.fetch(request, { bypassCustomProtocolHandlers: true });
    const file = localFile(decodeURIComponent(url.pathname));
    if (!file || !existsSync(file)) return new Response('Not found', { status: 404 });
    return new Response(readFileSync(file), {
      headers: {
        'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
        'content-security-policy': `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${endpointOrigin}`,
      },
    });
  });

  ipcMain.handle('game:config', () => ({ publishableKey, endpoint, app: appInfo }));
  // The renderer's web SDK owns the anonymous ID (a first-party cookie). The
  // main process uses the same ID, so both count as one player.
  ipcMain.handle('game:anonymous-id', (_event, anonymousId) => {
    if (typeof anonymousId !== 'string') return null;
    return analytics.start(anonymousId);
  });
  // A crash for testing app_crash: exit without the normal quit steps.
  ipcMain.handle('game:simulate-crash', () => app.exit(1));

  const window = new BrowserWindow({
    width: 900,
    height: 640,
    show: process.env.MANALENS_HIDE_WINDOW !== 'true',
    webPreferences: {
      preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.loadURL(`https://${rendererHost}/`);
});

app.on('window-all-closed', () => app.quit());

// A normal quit: the renderer sends session_end, then the main process sends
// app_quit, flushes for at most 2 seconds and removes the running flag.
let quitting = false;
app.on('before-quit', event => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  const windows = BrowserWindow.getAllWindows();
  const rendererDone = Promise.race([
    Promise.all(windows.map(window => window.webContents.executeJavaScript('window.gameQuit?.()', true).catch(() => {}))),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  rendererDone
    .then(() => analytics.quit(2000))
    .finally(() => app.exit(0));
});
