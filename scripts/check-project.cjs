"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const required = [
  "teleprompter.html",
  "teleprompter-v11.html",
  "livevoz-v11-runtime.js",
  "stage-server.cjs",
  "electron-main.cjs",
  "manifest.webmanifest",
  "sw.js",
  "livevoz-logo.png",
  "supabase/migrations/20260912022000_livevoz_v11.sql"
];

let failed = false;
for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`✗ Falta ${file}`);
    failed = true;
  } else {
    const stat = fs.statSync(full);
    if (!stat.size) {
      console.error(`✗ ${file} está vacío`);
      failed = true;
    } else {
      console.log(`✓ ${file} (${stat.size} bytes)`);
    }
  }
}

const html = fs.readFileSync(path.join(root, "teleprompter-v11.html"), "utf8");
for (const ref of ["./teleprompter.html", "./livevoz-v11-runtime.js"]) {
  if (!html.includes(ref)) {
    console.error(`✗ teleprompter-v11.html no referencia ${ref}`);
    failed = true;
  }
}

const runtime = fs.readFileSync(path.join(root, "livevoz-v11-runtime.js"), "utf8");
if (!runtime.includes("sb_publishable_")) {
  console.warn("! No se encontró una publishable key de Supabase en el runtime");
}
if (runtime.includes("service_role") || runtime.includes("sb_secret_")) {
  console.error("✗ Se detectó una credencial secreta que no debe estar en el cliente");
  failed = true;
}

if (failed) {
  console.error("\nLiveVoz check: FALLÓ");
  process.exit(1);
}
console.log("\nLiveVoz check: OK");
