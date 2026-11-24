// Cube Catch: a tiny three.js game. Move the paddle with the arrow keys, the
// mouse or touch. Catch 5 gold cubes to complete the level. Three red cubes
// on the paddle fail it. Each level is faster.
//
// Analytics: the web SDK with the `app` option (platform web, engine other,
// app_version, build). Every event is a web event that also carries
// context.app, so the App filters and breakdowns work for the game.
import * as THREE from 'three';
import { createAnalytics } from '@manalens/web';
import { GameAnalytics, type Tracker } from './game-analytics';

declare const __APP_VERSION__: string;

const publishableKey = import.meta.env.VITE_MANALENS_PUBLISHABLE_KEY as string | undefined;
const endpoint = import.meta.env.VITE_MANALENS_ENDPOINT as string | undefined;
const storefront = (import.meta.env.VITE_MANALENS_STOREFRONT as string | undefined) || 'itch';

// Without a key (for example in CI) the game runs and sends nothing.
const analytics = publishableKey && endpoint
  ? createAnalytics({
      publishableKey,
      endpoint,
      app: {
        platform: 'web',
        engine: 'other',
        storefront: storefront as 'itch',
        app_version: __APP_VERSION__,
        build: (import.meta.env.VITE_MANALENS_BUILD as string | undefined) || '1',
      },
    })
  : undefined;
if (!analytics) console.warn('Set VITE_MANALENS_PUBLISHABLE_KEY and VITE_MANALENS_ENDPOINT in .env. No events are sent.');
const tracker: Tracker = analytics ?? { track() {}, flush: async () => {} };
const game = new GameAnalytics(tracker);
game.open();

const levelLabel = document.getElementById('level')!;
const scoreLabel = document.getElementById('score')!;
const message = document.getElementById('message')!;

// ?demo=1 plays by itself: it completes level 1, fails level 2 and reports a
// handled error. The smoke test uses it.
const demo = new URLSearchParams(location.search).has('demo');

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (error) {
  // No WebGL (an old GPU, or a headless browser without it).
  game.error(error, { handled: true, error_type: 'WebGLUnavailable', severity: 'critical' });
  message.textContent = 'WebGL is not available in this browser.';
  if (demo) runDemoWithoutRendering();
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 4, 12);
camera.lookAt(0, 3, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223355, 2.5));

const paddle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1), new THREE.MeshStandardMaterial({ color: 0x38bdf8 }));
scene.add(paddle);
const cubeGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
const gold = new THREE.MeshStandardMaterial({ color: 0xfacc15 });
const red = new THREE.MeshStandardMaterial({ color: 0xef4444 });

interface Falling { mesh: THREE.Mesh; good: boolean }
const falling: Falling[] = [];
const keys = new Set<string>();
let level = 1;
let attempt = 1;
let caught = 0;
let hits = 0;
let score = 0;
let spawnIn = 0;
let paused = false;

function hud(): void {
  levelLabel.textContent = `Level ${level} (attempt ${attempt})`;
  scoreLabel.textContent = `Gold ${caught}/5  Red ${hits}/3  Score ${score}`;
}

function startLevel(): void {
  for (const item of falling) scene.remove(item.mesh);
  falling.length = 0;
  caught = 0;
  hits = 0;
  paused = false;
  message.textContent = '';
  game.levelStart(level, attempt);
  hud();
}

function endLevel(won: boolean): void {
  paused = true;
  if (won) {
    game.levelComplete(level, attempt, score);
    message.textContent = `Level ${level} complete`;
    level += 1;
    attempt = 1;
  } else {
    game.levelFail(level, attempt, score);
    message.textContent = `Level ${level} failed`;
    attempt += 1;
  }
  setTimeout(startLevel, demo ? 100 : 1500);
}

function spawn(): void {
  const good = Math.random() < 0.6;
  const mesh = new THREE.Mesh(cubeGeometry, good ? gold : red);
  mesh.position.set((Math.random() - 0.5) * 10, 9, 0);
  scene.add(mesh);
  falling.push({ mesh, good });
}

window.addEventListener('keydown', event => {
  keys.add(event.key);
  game.activity();
  // E reports a handled error, to see error events in the dashboard.
  if (event.key === 'e') game.error(new Error('Example handled error'), { handled: true });
});
window.addEventListener('keyup', event => keys.delete(event.key));
window.addEventListener('pointermove', event => {
  paddle.position.x = (event.clientX / window.innerWidth - 0.5) * 12;
  game.activity();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A lost WebGL context (a GPU reset, a driver update, too many contexts) is a
// canvas event, not an exception, so the error listeners never see it. Send it
// as a handled critical error. three.js restores its state when the browser
// gives the context back; pause the game until then.
renderer.domElement.addEventListener('webglcontextlost', () => {
  paused = true;
  message.textContent = 'Graphics paused. Waiting for the GPU.';
  game.error(new Error('WebGL context lost'), { handled: true, error_type: 'WebGLContextLost', severity: 'critical' });
  void tracker.flush();
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  message.textContent = '';
  paused = false;
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) {
    if (keys.has('ArrowLeft')) paddle.position.x -= 10 * dt;
    if (keys.has('ArrowRight')) paddle.position.x += 10 * dt;
    paddle.position.x = THREE.MathUtils.clamp(paddle.position.x, -6, 6);
    spawnIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = Math.max(0.35, 1.1 - level * 0.1); }
    const speed = 3 + level;
    for (let i = falling.length - 1; i >= 0; i--) {
      const item = falling[i]!;
      item.mesh.position.y -= speed * dt;
      item.mesh.rotation.x += dt;
      const onPaddle = item.mesh.position.y < 0.5 && item.mesh.position.y > -0.3 && Math.abs(item.mesh.position.x - paddle.position.x) < 1.5;
      if (onPaddle || item.mesh.position.y < -2) {
        scene.remove(item.mesh);
        falling.splice(i, 1);
        if (onPaddle && item.good) { caught += 1; score += 100; }
        if (onPaddle && !item.good) hits += 1;
        hud();
        if (caught >= 5) { endLevel(true); break; }
        if (hits >= 3) { endLevel(false); break; }
      }
    }
  }
  renderer.render(scene, camera);
});

startLevel();
if (demo) runDemo();

/** The demo: no player input; drive the level state directly. */
function runDemo(): void {
  setTimeout(() => { caught = 5; score += 500; endLevel(true); }, 300);
  setTimeout(() => { hits = 3; endLevel(false); }, 800);
  setTimeout(() => {
    game.error(new Error('Demo handled error'), { handled: true, error_type: 'DemoError' });
    void tracker.flush();
    document.title = 'demo done';
  }, 1200);
}

function runDemoWithoutRendering(): void {
  game.levelStart(1, 1);
  game.levelComplete(1, 1, 500);
  game.levelStart(2, 1);
  game.levelFail(2, 1, 0);
  void tracker.flush();
  document.title = 'demo done';
}
