// Run one step in every npm example.
//
//   node scripts/each.mjs install   pnpm install --frozen-lockfile
//   node scripts/each.mjs check     the build, type check, tests or SRI check of each
import { execFileSync } from 'node:child_process';

export const examples = [
  { dir: 'with-next', check: ['build'] },
  { dir: 'with-html', check: ['check'] },
  { dir: 'with-astro', check: ['build'] },
  { dir: 'with-threejs', check: ['build'] },
  { dir: 'with-react', check: ['build'] },
  { dir: 'with-electron', check: ['typecheck'] },
  { dir: 'with-express-server', check: ['check'] },
  { dir: 'with-stripe', check: ['typecheck'] },
  { dir: 'with-paddle', check: ['typecheck'] },
];

const step = process.argv[2];
if (step !== 'install' && step !== 'check') {
  console.error('Usage: node scripts/each.mjs install|check');
  process.exit(1);
}
for (const { dir, check } of examples) {
  console.log(`\n== ${dir}: ${step}`);
  const args = step === 'install' ? ['install', '--frozen-lockfile'] : ['run', ...check];
  execFileSync('pnpm', args, { cwd: new URL(`../${dir}/`, import.meta.url), stdio: 'inherit' });
}
