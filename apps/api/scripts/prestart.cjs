#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

// Move to repo root and run workspace builds so `dist` is present before start
const repoRoot = path.resolve(__dirname, '../../..');
try {
  process.chdir(repoRoot);
  console.log('prestart: cwd=', process.cwd());
  console.log('prestart: building @kadenatrace/shared');
  execSync('npm run build --workspace @kadenatrace/shared', { stdio: 'inherit' });
  console.log('prestart: building @kadenatrace/api');
  execSync('npm run build --workspace @kadenatrace/api', { stdio: 'inherit' });
  console.log('prestart: builds complete');
} catch (err) {
  console.error('prestart: build failed', err && err.message ? err.message : err);
  process.exit(1);
}
