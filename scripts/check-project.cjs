"use strict";
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const required = [
  "teleprompter.html",
  "teleprompter-v11.html",
  "livevoz-v11-runtime.js",
  "livevoz-v13-stage.html",
  "livevoz-v13-preload.cjs",
  "livevoz-v13-bridge.js",
  "livevoz-mobile-v13-1.html",
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
for (const ref of ["./teleprompter.html", "./livevoz-v11-runtime.js", "./livevoz-v13-bridge.js"]) {
  if (!html.includes(ref)) {
    console.error(`✗ teleprompter-v11.html no referencia ${ref}`);
    failed = true;
  }
}

const stagePanel = fs.readFileSync(path.join(root, "livevoz-v13-stage.html"), "utf8");
for (const text of ["Modo concierto", "Generar QR", "Preflight", "Dispositivos conectados", "LIVEVOZ_V13_GET_STAGE_CONTEXT"]) {
  if (!stagePanel.includes(text)) {
    console.error(`✗ Panel V13 no incluye: ${text}`);
    failed = true;
  }
}

const bridge = fs.readFileSync(path.join(root, "livevoz-v13-bridge.js"), "utf8");
for (const text of ["LIVEVOZ_V13_STAGE_CONTEXT", "LIVEVOZ_V13_SET_STAGE_CONFIG", "livevoz_ws_room_token"]) {
  if (!bridge.includes(text)) {
    console.error(`✗ Bridge V13 no incluye: ${text}`);
    failed = true;
  }
}

const electronMain = fs.readFileSync(path.join(root, "electron-main.cjs"), "utf8");
for (const ref of ["livevoz-v13-stage.html", "livevoz-v13-preload.cjs", "livevoz:start-stage", "QRCode.toDataURL"]) {
  if (!electronMain.includes(ref)) {
    console.error(`✗ electron-main.cjs no integra ${ref}`);
    failed = true;
  }
}

const stageServer = fs.readFileSync(path.join(root, "stage-server.cjs"), "utf8");
for (const text of ['PROTOCOL_VERSION = "13.1"', "DEVICE_PROFILE", "livevoz-mobile-v13-1.html", "livevozInstrument", "livevozTranspose"]) {
  if (!stageServer.includes(text)) {
    console.error(`✗ Stage Network V13.1 no incluye: ${text}`);
    failed = true;
  }
}
if (stageServer.includes('url.pathname==="/invite"')) {
  console.error("✗ Stage Network conserva el endpoint de invitación regresivo");
  failed = true;
}

const mobile = fs.readFileSync(path.join(root, "livevoz-mobile-v13-1.html"), "utf8");
for (const text of ["Transposición personal", "Trompeta en Sib", "Saxofón alto en Mib", "Bajo quinto", "DEVICE_PROFILE", "13.1"]) {
  if (!mobile.includes(text)) {
    console.error(`✗ Cliente móvil V13.1 no incluye: ${text}`);
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
