// Smoke test: send events from the examples to a collector and check that
// every request gets a 2xx answer.
//
//   cp .env.example .env    # fill in a TEST project's keys
//   pnpm install            # Playwright, for the browser checks
//   pnpm install:all        # each example's dependencies
//   pnpm smoke
//
// Environment:
//   MANALENS_ENDPOINT         the collector URL, without /v0/events (required)
//   MANALENS_PUBLISHABLE_KEY  a test project's Publishable key, mana_pk_... (required)
//   MANALENS_SECRET_KEY       the same project's Secret key, mana_sk_... (express check)
//   MANALENS_PAGE_HOST        the host for browser pages, on the project domain
//                             (default localhost)
//   MANALENS_SMOKE_ONLY       comma-separated checks to run (default: all)
//   GODOT                     the Godot 4 binary (default: godot on PATH)
//   UNITY                     the Unity Editor binary, 2021.3 or newer (the
//                             unity check is skipped without it)
//   UNREAL_GAME               a packaged with-unreal game binary (the unreal
//                             check is skipped without it)
//
// Checks:
//   express        with-express-server: the app with a server-mode client
//   electron-main  with-electron: the main-process module (app mode, the
//                  running flag and app_unclean_exit), in plain Node.js
//   godot          with-godot: the headless demo (skipped without Godot)
//   unity          with-unity: builds a desktop player, runs it in batch mode
//                  with --demo (skipped without UNITY)
//   unreal-http    with-unreal: request.example.json (the body that the C++
//                  subsystem sends) with new IDs and times
//   unreal         with-unreal: a packaged build with -ManalensDemo (skipped
//                  without UNREAL_GAME)
//   html           with-html: the snippet page in headless Chromium
//   threejs        with-threejs: the game's ?demo=1 run in headless Chromium
//   next           with-next: next dev in headless Chromium
//   react          with-react: vite dev in headless Chromium; one page event
//                  per React Router navigation, wishlist_clicked, identify
//   stripe-paddle  with-stripe-paddle: the store page in headless Chromium;
//                  identify() has the player ID that the server puts in the
//                  Stripe metadata and the Paddle custom data
//   astro          with-astro: the built site in headless Chromium, with
//                  View Transitions; one page event per page visited, with
//                  the path and title of that page (also after back)
//
// The browser checks need Playwright and its Chromium (npx playwright install
// chromium). Without them they are skipped. A skipped check does not fail the
// run; a failed one exits with code 1.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const endpoint = (process.env.MANALENS_ENDPOINT ?? '').replace(/\/+$/, '');
const publishableKey = process.env.MANALENS_PUBLISHABLE_KEY ?? '';
const secretKey = process.env.MANALENS_SECRET_KEY ?? '';
const pageHost = process.env.MANALENS_PAGE_HOST || 'localhost';
const only = new Set((process.env.MANALENS_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean));
const runId = `smoke-${Date.now()}`;
const eventsUrl = `${endpoint}/v0/events`;

if (!endpoint || !publishableKey) {
  console.error('Set MANALENS_ENDPOINT and MANALENS_PUBLISHABLE_KEY (and MANALENS_SECRET_KEY for the express check). See .env.example.');
  process.exit(1);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** @type {{ name: string, result: 'ok' | 'failed' | 'skipped', detail: string }[]} */
const results = [];
/** @type {import('node:child_process').ChildProcess[]} */
const children = [];

class Skip extends Error {}

async function check(name, fn) {
  if (only.size && !only.has(name)) return;
  console.log(`\n== ${name}`);
  try {
    const detail = await fn();
    results.push({ name, result: 'ok', detail: detail ?? '' });
    console.log(`ok: ${detail ?? ''}`);
  } catch (error) {
    const skipped = error instanceof Skip;
    results.push({ name, result: skipped ? 'skipped' : 'failed', detail: error.message });
    console.log(`${skipped ? 'skipped' : 'FAILED'}: ${error.message}`);
  }
}

/** A fetch that records the status of each collector request. */
function recordingFetch() {
  const statuses = [];
  const errors = [];
  const record = async (url, init) => {
    const response = await fetch(url, init);
    statuses.push(response.status);
    if (!response.ok) errors.push(`${response.status} ${await response.clone().text()}`);
    return response;
  };
  return { statuses, errors, fetch: record };
}

function assertAll2xx(statuses, errors = []) {
  if (statuses.length === 0) throw new Error('no request reached the collector');
  const bad = statuses.filter(status => status < 200 || status > 299);
  if (bad.length) throw new Error(`non-2xx answers: ${bad.join(', ')} ${errors.join(' | ').slice(0, 500)}`);
  return `${statuses.length} request(s), all 2xx (${[...new Set(statuses)].join(', ')})`;
}

function needInstall(dir) {
  if (!existsSync(join(root, dir, 'node_modules'))) throw new Skip(`run pnpm install in ${dir} first (or pnpm install:all)`);
}

/** The Node SDK as installed in one example. */
async function nodeSdk(dir) {
  const require = createRequire(join(root, dir, 'package.json'));
  return import(pathToFileURL(require.resolve('@manalens/node')).href);
}

function start(command, args, options) {
  const child = spawn(command, args, { ...options, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = [];
  child.stdout.on('data', chunk => log.push(String(chunk)));
  child.stderr.on('data', chunk => log.push(String(chunk)));
  children.push(child);
  return { child, log };
}

function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
}

async function waitForHttp(url, timeoutMs, log) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fetch(url).then(() => true, () => false)) return;
    await sleep(300);
  }
  throw new Error(`${url} did not answer in ${timeoutMs / 1000} s\n${log.join('').slice(-1500)}`);
}

// Node.js checks --------------------------------------------------------------

await check('express', async () => {
  if (!secretKey) throw new Skip('MANALENS_SECRET_KEY is not set');
  needInstall('with-express-server');
  const { Manalens } = await nodeSdk('with-express-server');
  const { createApp } = await import(pathToFileURL(join(root, 'with-express-server/src/app.mjs')).href);
  const recorder = recordingFetch();
  const analytics = new Manalens(secretKey, { endpoint, fetch: recorder.fetch, debug: true, logger: message => console.log(message) });
  const app = createApp({ analytics, webhookSecret: 'smoke-secret' });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const post = (path, body, headers = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const checkout = await post('/api/checkout', { userId: `${runId}-user`, anonymousId: randomUUID(), items: ['a', 'b'] }, { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' });
    if (checkout.status !== 204) throw new Error(`/api/checkout answered ${checkout.status}`);
    const refused = await post('/webhooks/purchase', { event_id: 'x', user_id: 'u', amount_cents: 1 }, { 'x-webhook-secret': 'wrong' });
    if (refused.status !== 401) throw new Error(`a wrong webhook secret got ${refused.status}, not 401`);
    const webhook = await post('/webhooks/purchase', { event_id: `${runId}-evt`, user_id: `${runId}-user`, amount_cents: 499, currency: 'USD', sku: 'dlc_harbor', store: 'web' }, { 'x-webhook-secret': 'smoke-secret' });
    if (webhook.status !== 204) throw new Error(`/webhooks/purchase answered ${webhook.status}`);
  } finally {
    server.close();
    await analytics.shutdown();
  }
  return assertAll2xx(recorder.statuses, recorder.errors);
});

await check('electron-main', async () => {
  needInstall('with-electron');
  const { MainAnalytics, platformFromOS } = await import(pathToFileURL(join(root, 'with-electron/src/main-analytics.mjs')).href);
  const userDataDir = mkdtempSync(join(tmpdir(), 'manalens-electron-smoke-'));
  try {
    // A flag left by a run that did not quit: the next start sends app_unclean_exit.
    writeFileSync(join(userDataDir, 'manalens-running.json'), JSON.stringify({ session_id: randomUUID(), build: 'smoke-previous' }));
    const recorder = recordingFetch();
    const main = new MainAnalytics({
      publishableKey,
      endpoint,
      userDataDir,
      app: { platform: platformFromOS(process.platform), storefront: 'steam', app_version: '1.0.0', build: 'smoke', engine: 'other' },
      fetch: recorder.fetch,
    });
    const started = main.start(randomUUID());
    if (!started.uncleanExit) throw new Error('the running flag did not give uncleanExit');
    await main.quit();
    if (existsSync(join(userDataDir, 'manalens-running.json'))) throw new Error('quit() did not remove the running flag');
    return `app_unclean_exit, app_started, app_quit: ${assertAll2xx(recorder.statuses, recorder.errors)}`;
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

await check('godot', async () => {
  const godot = process.env.GODOT || 'godot';
  if (spawnSync(godot, ['--version'], { encoding: 'utf8' }).status !== 0) throw new Skip(`no Godot binary (${godot}); set GODOT`);
  const project = join(root, 'with-godot');
  spawnSync(godot, ['--headless', '--path', project, '--import'], { encoding: 'utf8', timeout: 120_000 });
  const run = spawnSync(godot, ['--headless', '--path', project, '--', '--demo', `--endpoint=${endpoint}`, `--publishable-key=${publishableKey}`], { encoding: 'utf8', timeout: 60_000 });
  const line = `${run.stdout}`.split('\n').find(l => l.startsWith('MANALENS_DEMO '));
  if (!line) throw new Error(`no MANALENS_DEMO line (exit ${run.status})\n${`${run.stdout}${run.stderr}`.slice(-1500)}`);
  const demo = JSON.parse(line.slice('MANALENS_DEMO '.length));
  if (run.status !== 0) throw new Error(`exit ${run.status}: ${line}`);
  return `${demo.events_sent} events in ${demo.sends_ok} request(s), all 2xx, queue empty`;
});

await check('unity', async () => {
  const unity = process.env.UNITY;
  if (!unity || !existsSync(unity)) throw new Skip('set UNITY to the Unity Editor binary, for example /Applications/Unity/Hub/Editor/<version>/Unity.app/Contents/MacOS/Unity');
  const project = join(root, 'with-unity');
  const build = spawnSync(unity, ['-batchmode', '-nographics', '-quit', '-projectPath', project, '-executeMethod', 'BuildDemo.Build', '-logFile', '-'], { encoding: 'utf8', timeout: 20 * 60_000, maxBuffer: 64 * 1024 * 1024 });
  if (build.status !== 0) throw new Error(`player build failed (exit ${build.status})\n${`${build.stdout}${build.stderr}`.slice(-2000)}`);
  const player = {
    darwin: 'Build/with-unity.app/Contents/MacOS/with-unity',
    win32: 'Build/with-unity.exe',
    linux: 'Build/with-unity.x86_64',
  }[process.platform];
  if (!player) throw new Skip(`no Unity player for ${process.platform}`);
  const run = spawnSync(join(project, player), ['-batchmode', '-nographics', '-logFile', '-', '--demo', `--endpoint=${endpoint}`, `--publishable-key=${publishableKey}`], { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout}${run.stderr}`;
  const line = output.split('\n').map(l => l.slice(l.indexOf('MANALENS_DEMO '))).find(l => l.startsWith('MANALENS_DEMO '));
  if (!line) throw new Error(`no MANALENS_DEMO line (exit ${run.status})\n${output.slice(-1500)}`);
  const demo = JSON.parse(line.slice('MANALENS_DEMO '.length).trim());
  if (run.status !== 0) throw new Error(`exit ${run.status}: ${line}`);
  return `${demo.events_sent} events in ${demo.sends_ok} request(s), all 2xx, queue empty`;
});

await check('unreal-http', async () => {
  // The same body as UAnalyticsSubsystem::Flush(), with new IDs and times, so
  // the collector accepts it again (each message_id counts once, and an event
  // can be at most 7 days old).
  const { readFileSync } = await import('node:fs');
  const body = JSON.parse(readFileSync(join(root, 'with-unreal/request.example.json'), 'utf8'));
  const anonymousId = randomUUID();
  const sessionId = randomUUID();
  const now = Date.now();
  body.events.forEach((event, index) => {
    Object.assign(event, { message_id: randomUUID(), anonymous_id: anonymousId, session_id: sessionId, original_timestamp: new Date(now + index).toISOString() });
    if (event.event === 'game_open') event.properties.first_open_at = new Date(now).toISOString();
    if (event.type === 'identify') event.user_id = `${runId}-unreal`;
  });
  const response = await fetch(eventsUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-publishable-key': publishableKey }, body: JSON.stringify(body) });
  const text = await response.text();
  if (response.status !== 202) throw new Error(`${response.status} ${text.slice(0, 500)}`);
  return `${body.events.length} events: 202 ${text}`;
});

await check('unreal', async () => {
  const game = process.env.UNREAL_GAME;
  if (!game || !existsSync(game)) throw new Skip('set UNREAL_GAME to a packaged with-unreal game binary (see with-unreal/README.md)');
  const run = spawnSync(game, ['-ManalensDemo', `-ManalensEndpoint=${endpoint}`, `-ManalensKey=${publishableKey}`, '-nullrhi', '-unattended', '-stdout', '-FullStdOutLogOutput'], { encoding: 'utf8', timeout: 120_000, maxBuffer: 64 * 1024 * 1024 });
  const output = `${run.stdout}${run.stderr}`;
  const sends = [...output.matchAll(/MANALENS_SEND status=(\d+) events=(\d+)/g)].map(match => ({ status: Number(match[1]), events: Number(match[2]) }));
  if (!output.includes('MANALENS_DEMO done')) throw new Error(`no MANALENS_DEMO line (exit ${run.status})\n${output.slice(-1500)}`);
  const detail = assertAll2xx(sends.map(send => send.status));
  return `${sends.reduce((sum, send) => sum + send.events, 0)} events: ${detail}`;
});

// Browser checks --------------------------------------------------------------

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  chromium = undefined;
}
let browser;
async function newPage() {
  if (!chromium) throw new Skip('Playwright is not installed (pnpm install at the repository root)');
  browser ??= await chromium.launch().catch(error => { throw new Skip(`Chromium did not start (npx playwright install chromium): ${error.message.split('\n')[0]}`); });
  const page = await (await browser.newContext()).newPage();
  const statuses = [];
  const consoleErrors = [];
  // A request that got its answer counts once. Chromium can still report it
  // as failed (net::ERR_ABORTED) when a navigation stops the read of the
  // answer body; the collector has accepted the events then.
  const answered = new WeakSet();
  page.on('response', response => {
    if (response.url() !== eventsUrl || response.request().method() !== 'POST') return;
    answered.add(response.request());
    statuses.push(response.status());
  });
  page.on('requestfailed', request => {
    if (request.url() === eventsUrl && request.method() === 'POST' && !answered.has(request)) statuses.push(`failed: ${request.failure()?.errorText}`);
  });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  return { page, statuses, consoleErrors };
}

async function waitForRequests(statuses, count, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (statuses.length < count && Date.now() < deadline) await sleep(250);
}

function browserResult(statuses, consoleErrors) {
  const numeric = statuses.filter(status => typeof status === 'number');
  if (numeric.length !== statuses.length) throw new Error(`requests failed: ${statuses.join(', ')} ${consoleErrors.join(' | ').slice(0, 500)}`);
  return assertAll2xx(numeric, consoleErrors);
}

await check('html', async () => {
  needInstall('with-html');
  const port = 18080;
  const { child, log } = start('node', ['serve.mjs'], { cwd: join(root, 'with-html'), env: { ...process.env, PORT: String(port), MANALENS_ENDPOINT: endpoint, MANALENS_PUBLISHABLE_KEY: publishableKey } });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, 10_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    await page.goto(`http://${pageHost}:${port}/`);
    await page.waitForFunction(() => Boolean(window.manalens), null, { timeout: 10_000 });
    await page.click('#signup');
    // Leaving the page sends the queue (page view and signup_clicked).
    await page.goto(`http://${pageHost}:${port}/pricing.html`);
    await page.waitForFunction(() => Boolean(window.manalens), null, { timeout: 10_000 });
    await page.evaluate(() => window.manalens.flush());
    await waitForRequests(statuses, 2, 15_000);
    await page.close();
    return `page_view x2, signup_clicked: ${browserResult(statuses, consoleErrors)}`;
  } finally {
    stop(child);
  }
});

await check('threejs', async () => {
  needInstall('with-threejs');
  const port = 15173;
  const { child, log } = start('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort', '--host'], {
    cwd: join(root, 'with-threejs'),
    env: { ...process.env, VITE_MANALENS_ENDPOINT: endpoint, VITE_MANALENS_PUBLISHABLE_KEY: publishableKey, VITE_MANALENS_BUILD: 'smoke' },
  });
  try {
    await waitForHttp(`http://localhost:${port}/`, 30_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    await page.goto(`http://${pageHost}:${port}/?demo=1`);
    await page.waitForFunction(() => document.title === 'demo done', null, { timeout: 30_000 });
    await waitForRequests(statuses, 1, 15_000);
    // pagehide sends session_end.
    await page.close({ runBeforeUnload: true });
    await sleep(1000);
    return `game_open, session_start, level_*, error: ${browserResult(statuses, consoleErrors.filter(text => !/WebGL|GPU stall|GroupMarkerNotSet/i.test(text)))}`;
  } finally {
    stop(child);
  }
});

await check('next', async () => {
  needInstall('with-next');
  const port = 13000;
  const { child, log } = start('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
    cwd: join(root, 'with-next'),
    env: { ...process.env, NEXT_PUBLIC_MANALENS_ENDPOINT: endpoint, NEXT_PUBLIC_MANALENS_PUBLISHABLE_KEY: publishableKey, NEXT_TELEMETRY_DISABLED: '1' },
  });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, 90_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    await page.goto(`http://${pageHost}:${port}/`, { timeout: 90_000 });
    await page.getByRole('link', { name: 'Pricing', exact: true }).click();
    await page.waitForURL('**/pricing');
    await page.getByRole('button', { name: 'Start trial (custom event)' }).click();
    // identify() sends the queue at once.
    await page.getByRole('button', { name: 'Sign in (identify)' }).click();
    await page.getByText('identify: demo_user_42').waitFor();
    await waitForRequests(statuses, 1, 15_000);
    await page.close();
    return `page x2, trial_started, identify: ${browserResult(statuses, consoleErrors.filter(text => !/Download the React DevTools|HMR/i.test(text)))}`;
  } finally {
    stop(child);
  }
});

await check('react', async () => {
  needInstall('with-react');
  const port = 15174;
  const { child, log } = start('pnpm', ['exec', 'vite', '--port', String(port), '--strictPort', '--host'], {
    cwd: join(root, 'with-react'),
    env: { ...process.env, VITE_MANALENS_ENDPOINT: endpoint, VITE_MANALENS_PUBLISHABLE_KEY: publishableKey },
  });
  try {
    await waitForHttp(`http://localhost:${port}/`, 30_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    // The Steam button opens a new tab: close it.
    page.context().on('page', popup => { if (popup !== page) void popup.close(); });
    const pageViews = [];
    const tracked = [];
    page.on('request', request => {
      if (request.url() !== eventsUrl || request.method() !== 'POST') return;
      for (const event of JSON.parse(request.postData() ?? '{}').events ?? []) {
        if (event.type === 'page') pageViews.push(event.context?.page?.path);
        else tracked.push(event.type === 'track' ? event.event : event.type);
      }
    });
    const base = `http://${pageHost}:${port}`;
    await page.goto(`${base}/`);
    await page.getByRole('button', { name: 'Wishlist on Steam' }).click();
    await page.getByRole('link', { name: 'Devlog' }).click();
    await page.waitForURL(`${base}/devlog`);
    await page.getByRole('link', { name: 'Newsletter' }).click();
    await page.waitForURL(`${base}/newsletter`);
    await page.getByRole('textbox', { name: 'Email' }).fill('player@example.test');
    // identify() sends the queue at once.
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.getByText('Thanks for subscribing.').waitFor();
    await waitForRequests(statuses, 1, 15_000);
    await sleep(1000);
    await page.close();
    const result = browserResult(statuses, consoleErrors.filter(text => !/Download the React DevTools|ERR_|Failed to load resource/i.test(text)));
    // One page event per navigation, also with React's development double effects.
    if (pageViews.join(',') !== '/,/devlog,/newsletter') throw new Error(`page events: ${pageViews.join(', ')} (expected /, /devlog, /newsletter)`);
    for (const name of ['wishlist_clicked', 'identify']) if (!tracked.includes(name)) throw new Error(`no ${name} event (sent: ${tracked.join(', ')})`);
    return `page x3, wishlist_clicked, identify: ${result}`;
  } finally {
    stop(child);
  }
});

await check('stripe-paddle', async () => {
  needInstall('with-stripe-paddle');
  const port = 18090;
  // No Stripe or Paddle keys: the check needs no payment account and buys nothing.
  const env = { ...process.env, PORT: String(port), MANALENS_ENDPOINT: endpoint, MANALENS_PUBLISHABLE_KEY: publishableKey, STRIPE_SECRET_KEY: '', PADDLE_CLIENT_TOKEN: '' };
  const { child, log } = start('node', ['src/server.mjs'], { cwd: join(root, 'with-stripe-paddle'), env });
  try {
    await waitForHttp(`http://127.0.0.1:${port}/`, 10_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    const identified = [];
    page.on('request', request => {
      if (request.url() !== eventsUrl || request.method() !== 'POST') return;
      for (const event of JSON.parse(request.postData() ?? '{}').events ?? []) if (event.type === 'identify') identified.push(event.user_id);
    });
    await page.goto(`http://${pageHost}:${port}/`);
    const playerId = await page.evaluate(() => document.body.dataset.playerId);
    await waitForRequests(statuses, 1, 15_000);
    await sleep(500);
    const stripe = await page.evaluate(() => fetch('/api/stripe/checkout', { method: 'POST' }).then(response => response.status));
    await page.close();
    if (!/^player_[a-f0-9]{12}$/.test(playerId ?? '')) throw new Error(`no player ID in the page: ${playerId}`);
    if (!identified.includes(playerId)) throw new Error(`no identify with ${playerId} (sent: ${identified.join(', ') || 'none'})`);
    if (stripe !== 501) throw new Error(`POST /api/stripe/checkout without a key answered ${stripe}, not 501`);
    return `identify ${playerId}: ${browserResult(statuses, consoleErrors.filter(text => !/paddle|ERR_|Failed to load resource/i.test(text)))}`;
  } finally {
    stop(child);
  }
});

await check('astro', async () => {
  needInstall('with-astro');
  const port = 14321;
  const dir = join(root, 'with-astro');
  const env = { ...process.env, PUBLIC_MANALENS_ENDPOINT: endpoint, PUBLIC_MANALENS_PUBLISHABLE_KEY: publishableKey, ASTRO_TELEMETRY_DISABLED: '1' };
  // PUBLIC_ values are read at build time: build with the test key, then serve dist/.
  const build = spawnSync('pnpm', ['run', 'build'], { cwd: dir, env, encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`pnpm run build failed\n${`${build.stdout}${build.stderr}`.slice(-1500)}`);
  const { child, log } = start('pnpm', ['exec', 'astro', 'preview', '--port', String(port), '--allowed-hosts', pageHost, '--ignore-lock'], { cwd: dir, env });
  try {
    await waitForHttp(`http://localhost:${port}/`, 30_000, log);
    const { page, statuses, consoleErrors } = await newPage();
    /** The page events in the request bodies, in order: the path of each. */
    const pageViews = [];
    const tracked = [];
    page.on('request', request => {
      if (request.url() !== eventsUrl || request.method() !== 'POST') return;
      for (const event of JSON.parse(request.postData() ?? '{}').events ?? []) {
        if (event.type === 'page') pageViews.push(`${event.context?.page?.path} "${event.context?.page?.title}"`);
        else tracked.push(event.type === 'track' ? event.event : event.type);
      }
    });
    const base = `http://${pageHost}:${port}`;
    const visited = [];
    const ready = () => page.waitForFunction(() => Boolean(window.manalens), null, { timeout: 10_000 });
    /** A View Transitions navigation: the URL changes, the page does not load again. */
    const softNavigate = async (go, path) => {
      await go();
      await page.waitForURL(`${base}${path}`);
      await page.waitForFunction(p => document.documentElement.dataset.smokePageLoad === p, path, { timeout: 10_000 });
      if (!(await page.evaluate(() => window.__smokeSameDocument === true))) throw new Error(`${path} loaded a full page, not a View Transitions navigation`);
      visited.push({ path, title: await page.title() });
    };

    // 1. Home: a full page load. The custom event and identify().
    await page.goto(`${base}/`);
    await ready();
    visited.push({ path: '/', title: await page.title() });
    await page.getByRole('button', { name: 'Wishlist on Steam' }).click();
    await page.getByRole('textbox', { name: 'Email' }).fill('player@example.test');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await page.getByText('identify() sent').waitFor();

    // 2. The devlog: a full page load (home has no <ClientRouter />).
    await page.getByRole('link', { name: 'Read the devlog' }).click();
    await page.waitForURL(`${base}/devlog/`);
    await ready();
    visited.push({ path: '/devlog/', title: await page.title() });
    // Mark this document and each astro:page-load, to tell a View Transitions
    // navigation from a full page load.
    await page.evaluate(() => {
      window.__smokeSameDocument = true;
      document.addEventListener('astro:page-load', () => { document.documentElement.dataset.smokePageLoad = location.pathname; });
    });

    // 3 to 6. View Transitions: link, link, back, link.
    await softNavigate(() => page.getByRole('link', { name: 'Devlog 1: First light' }).click(), '/devlog/first-light/');
    await softNavigate(() => page.getByRole('link', { name: /^Next: / }).click(), '/devlog/the-storm/');
    await softNavigate(() => page.evaluate(() => history.back()), '/devlog/first-light/');
    await softNavigate(() => page.getByRole('link', { name: 'All posts' }).click(), '/devlog/');

    await page.evaluate(() => window.manalens.flush());
    await sleep(1000);
    await waitForRequests(statuses, 2, 15_000);
    await page.close();
    const result = browserResult(statuses, consoleErrors);
    // Each page event has the path and the title of the page visited (also
    // after back: the title of the page you go to, not the page you left).
    const expected = visited.map(({ path, title }) => `${path === '/' ? '/' : path.replace(/\/$/, '')} "${title}"`);
    if (pageViews.join(',') !== expected.join(',')) {
      throw new Error(`${visited.length} pages visited, ${pageViews.length} page events sent:\n  visited ${expected.join(', ')}\n  sent    ${pageViews.join(', ')}`);
    }
    for (const name of ['wishlist_clicked', 'identify']) if (!tracked.includes(name)) throw new Error(`no ${name} event (sent: ${tracked.join(', ')})`);
    return `${visited.length} pages visited, ${pageViews.length} page events (${pageViews.join(', ')}), wishlist_clicked, identify: ${result}`;
  } finally {
    stop(child);
  }
});

await browser?.close();
for (const child of children) stop(child);

console.log('\nSummary');
for (const { name, result, detail } of results) console.log(`  ${result.padEnd(7)} ${name.padEnd(14)} ${detail.split('\n')[0]}`);
process.exit(results.some(r => r.result === 'failed') ? 1 : 0);
