#!/usr/bin/env node

import { execSync } from 'child_process'
import { cpSync, mkdirSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

// ─── Helpers ────────────────────────────────────────────────────────────────

function run(cmd) {
    console.log(`\n▶ ${cmd}`)
    execSync(cmd, { stdio: 'inherit' })
}

function copy(srcGlob, destDir) {
  mkdirSync(join(ROOT, destDir), { recursive: true });

  // copyfiles -f aplatit les fichiers dans destDir (pas de sous-dossiers)
  run(`copyfiles -f ${srcGlob} ${destDir}`);
}

// ─── Build TypeScript ────────────────────────────────────────────────────────

console.log("\n━━━ TypeScript build ━━━");
run("tsc --build src/app");
run("tsc --build src/user/js");
run("tsc --build src/admin/js");
run("tsc --build src/db/js");
run("tsc --build src/launcher/js");
// ─── Copie des assets ────────────────────────────────────────────────────────

console.log("\n━━━ Copie des assets ━━━");

const copies = [
  // HTML
  ["src/user/html/**/*.html",  "app_dist/user/html/"],
  ["src/admin/html/**/*.html", "app_dist/admin/html/"],
    ["src/db/html/**/*.html", "app_dist/db/html/"],
    ["src/launcher/html/**/*.html", "app_dist/launcher/html/"],
  // CSS
  ["src/user/css/*.css",       "app_dist/user/css/"],
  ["src/admin/css/*.css",      "app_dist/admin/css/"],
    ["src/db/css/*.css",      "app_dist/db/css/"],
    ["src/launcher/css/*.css",      "app_dist/launcher/css/"],
  // Audio
  ["src/user/audio/*",         "app_dist/user/audio/"],
  // Images
  ["src/user/img/*",       "app_dist/user/img/"],
  ["src/admin/img/*",      "app_dist/admin/img/"],
    ["src/db/img/*",      "app_dist/db/img/"],
    ["src/launcher/img/*",      "app_dist/launcher/img/"],
  // Three.js assets
  ["src/user/three/*",         "app_dist/user/three/"]
];

for (const [src, dest] of copies) {
  copy(src, dest);
}

console.log("\n✅ Build terminé avec succès !\n");
