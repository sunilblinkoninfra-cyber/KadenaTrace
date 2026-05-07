#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '../dist');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.isFile() && full.endsWith('.js')) fixFile(full);
  }
}

function fixFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  // Replace import/export specifiers that are relative and lack an extension
  const re = /((?:from\s+|export\s*\*\s*from\s+))(['"])(\.\.?\/.+?)(['"])/g;
  let changed = false;
  src = src.replace(re, (m, stmt, openQ, rel, closeQ) => {
    // If path already has an extension, leave it
    if (path.extname(rel)) return m;
    // If path ends with a slash, leave it
    if (rel.endsWith('/')) return m;
    changed = true;
    return `${stmt}${openQ}${rel}.js${closeQ}`;
  });
  if (changed) {
    fs.writeFileSync(file, src, 'utf8');
    console.log('fixed imports in', file);
  }
}

if (!fs.existsSync(distDir)) {
  console.warn('dist folder not found, skipping add-js-ext');
  process.exit(0);
}

walk(distDir);
