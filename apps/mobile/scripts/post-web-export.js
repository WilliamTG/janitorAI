#!/usr/bin/env node
/**
 * Post-export script for the Expo web static build.
 * Replaces the generic favicon.ico Expo generates with our branded PNG,
 * and patches the HTML files to reference it correctly.
 */

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const SRC_FAVICON = path.join(__dirname, '..', 'assets', 'images', 'docrai_favicon.png');

if (!fs.existsSync(DIST)) {
  console.error('dist/ folder not found — run expo export first.');
  process.exit(1);
}

// 1. Copy branded PNG into dist root as both favicon.png and favicon.ico
//    Browsers that parse <link rel="icon"> will use the PNG; the .ico copy
//    satisfies legacy browser auto-discovery of /favicon.ico.
fs.copyFileSync(SRC_FAVICON, path.join(DIST, 'favicon.png'));
fs.copyFileSync(SRC_FAVICON, path.join(DIST, 'favicon.ico'));
console.log('✓ Copied docrai_favicon.png → dist/favicon.png and dist/favicon.ico');

// 2. Patch every HTML file: replace the Expo default favicon link and
//    inject/replace <title>
const htmlFiles = fs.readdirSync(DIST, { recursive: true })
  .filter((f) => typeof f === 'string' && f.endsWith('.html'))
  .map((f) => path.join(DIST, f));

let patched = 0;
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');

  // Replace any existing favicon link (ico or png) with our PNG
  html = html.replace(
    /<link\s+rel="(?:shortcut )?icon"[^>]*>/gi,
    '<link rel="icon" type="image/png" href="/favicon.png"/>'
  );

  // Set the title — replace empty or any existing title content
  if (html.includes('<title')) {
    html = html.replace(/<title[^>]*>[^<]*<\/title>/i, '<title>DocrAI</title>');
  } else {
    html = html.replace('<head>', '<head><title>DocrAI</title>');
  }

  fs.writeFileSync(file, html, 'utf8');
  patched++;
}
console.log(`✓ Patched ${patched} HTML file(s) with correct favicon link and <title>DocrAI</title>`);
