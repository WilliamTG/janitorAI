#!/usr/bin/env node
/**
 * Preinstall guard: every path declared in the root workspaces array must
 * exist as a directory. Exits 1 with a clear error if any are missing so
 * `npm install` fails loudly instead of leaving ghost lock entries.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const workspaces = pkg.workspaces ?? [];
const missing = [];

for (const pattern of workspaces) {
  // Only handle explicit paths (no globs); globs are intentionally disallowed
  // by this project's convention — see the workspaces field in package.json.
  if (pattern.includes("*")) {
    console.error(
      `[check-workspaces] ERROR: Glob pattern "${pattern}" found in workspaces.\n` +
      `  List workspace directories explicitly so deleted packages can't leave ghost entries.`
    );
    process.exit(1);
  }

  const full = path.join(root, pattern);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) {
    missing.push(pattern);
  }
}

if (missing.length > 0) {
  console.error(
    "[check-workspaces] ERROR: The following workspace directories are declared in\n" +
    "package.json but do not exist on disk. Remove them from the workspaces array\n" +
    "and update any package.json files that reference them before running `npm install`.\n\n" +
    missing.map((p) => `  - ${p}`).join("\n")
  );
  process.exit(1);
}

console.log(`[check-workspaces] OK — all ${workspaces.length} workspace(s) verified.`);
