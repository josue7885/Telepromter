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
  "livevoz-v13-2-sync.js",
  "livevoz-v14-runtime.js",
  "livevoz-v14-cloud.js",
  "livevoz-mobile-v13-1.html",
  "livevoz-mobile-v13-2.html",
  "stage-server.cjs",
  "electron-main.cjs",
  "manifest.webmanifest",
  "sw.js",
  "livevoz-logo.png",
  "supabase/migrations/20260912022000_livevoz_v11.sql",
  "supabase/migrations/20260913093000_livevoz_v14_stage_director.sql"
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
    } else console.log(`✓ ${file} (${stat.size} bytes)`);
  }
}

const html = fs.readFileSync(path.join(root, "teleprompter-v11.html"), "utf8");
for (const ref of ["./teleprompter.html", "./livevoz-v11-runtime.js", "./livevoz-v13-bridge.js", "./livevoz-v13-2-sync.js", "./livevoz-v14-runtime.js", "./livevoz-v14-cloud.js"]) {
  if (!html.includes(ref)) { console.error(`✗ teleprompter-v11.html no referencia ${ref}`); failed = true; }
}

const stagePanel = fs.readFileSync(path.join(root, "livevoz-v13-stage.html"), "utf8");
for (const text of ["V14", "Modo concierto", "Generar QR", "Preflight", "Músicos y dispositivos", "battery", "Pantalla externa", "openStageDisplay"]) {
  if (!stagePanel.includes(text)) { console.error(`✗ Panel Stage no incluye: ${text}`); failed = true; }
}

const preload = fs.readFileSync(path.join(root, "livevoz-v13-preload.cjs"), "utf8");
for (const text of ["openStageDisplay", "closeStageDisplay", "livevoz:open-stage-display"]) {
  if (!preload.includes(text)) { console.error(`✗ Preload no incluye: ${text}`); failed = true; }
}

const bridge = fs.readFileSync(path.join(root, "livevoz-v13-bridge.js"), "utf8");
for (const text of ["LIVEVOZ_V13_STAGE_CONTEXT", "LIVEVOZ_V13_SET_STAGE_CONFIG", "livevoz_stage_session_room"]) {
  if (!bridge.includes(text)) { console.error(`✗ Bridge no incluye: ${text}`); failed = true; }
}

const sync = fs.readFileSync(path.join(root, "livevoz-v13-2-sync.js"), "utf8");
for (const text of ["13.2", "livevoz_stage_session_room", "concertSongIds", "lineText", "lineChords", "connectWebSocket"]) {
  if (!sync.includes(text)) { console.error(`✗ Sync base no incluye: ${text}`); failed = true; }
}

const v14 = fs.readFileSync(path.join(root, "livevoz-v14-runtime.js"), "utf8");
for (const text of ["Stage Director", "PRELOAD", "COUNTDOWN", "LOCK_STAGE", "PRIVATE_NOTE", "DEVICE_TELEMETRY", "STAGE_MODE", "requestMIDIAccess", "wakeLock", "Preflight", "Serenata", "instrumentNotes"]) {
  if (!v14.toLowerCase().includes(text.toLowerCase())) { console.error(`✗ Runtime V14 no incluye: ${text}`); failed = true; }
}

const cloud = fs.readFileSync(path.join(root, "livevoz-v14-cloud.js"), "utf8");
for (const text of ["share_concert_by_email", "song_instrument_parts", "Administrador", "Operador", "Exportar reporte", "sb_publishable_"]) {
  if (!cloud.includes(text)) { console.error(`✗ Cloud V14 no incluye: ${text}`); failed = true; }
}
if (cloud.includes("service_role") || cloud.includes("sb_secret_")) { console.error("✗ Cloud V14 contiene una credencial secreta"); failed = true; }

const electronMain = fs.readFileSync(path.join(root, "electron-main.cjs"), "utf8");
for (const ref of ["livevoz-v13-stage.html", "livevoz-v13-preload.cjs", "livevoz:start-stage", "QRCode.toDataURL", "openStageDisplay", "screen.getAllDisplays", "midiSysex"]) {
  if (!electronMain.includes(ref)) { console.error(`✗ electron-main.cjs no integra ${ref}`); failed = true; }
}

const stageServer = fs.readFileSync(path.join(root, "stage-server.cjs"), "utf8");
for (const text of ['PROTOCOL_VERSION = "14.0"', "DEVICE_PROFILE", "DEVICE_TELEMETRY", "PRIVATE_NOTE", "COUNTDOWN", "PRELOAD", "LOCK_STAGE", "STAGE_MODE", '"/app"', "livevoz-v14-runtime.js", "livevoz-v14-cloud.js"]) {
  if (!stageServer.includes(text)) { console.error(`✗ Stage Network V14 no incluye: ${text}`); failed = true; }
}
if (stageServer.includes('url.pathname==="/invite"')) { console.error("✗ Stage Network conserva el endpoint de invitación regresivo"); failed = true; }

const mobile = fs.readFileSync(path.join(root, "livevoz-mobile-v13-2.html"), "utf8");
for (const text of ["Entrar a LiveVoz completo", "stageRoom", "Trompeta en Sib", "Saxofón alto en Mib", "Bajo quinto"]) {
  if (!mobile.includes(text)) { console.error(`✗ Cliente móvil no incluye: ${text}`); failed = true; }
}

const manifest = fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
if (!manifest.includes("LiveVoz V14 Stage Director") || !manifest.includes('"./app"')) { console.error("✗ Manifest no apunta a V14 /app"); failed = true; }
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
if (!sw.includes("livevoz-teleprompter-v14") || !sw.includes("livevoz-v14-runtime.js") || !sw.includes("livevoz-v14-cloud.js")) { console.error("✗ Service Worker no cachea todos los módulos V14"); failed = true; }

const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260913093000_livevoz_v14_stage_director.sql"), "utf8");
for (const text of ["device_profiles", "song_instrument_parts", "event_runs", "admin", "operator"]) {
  if (!migration.includes(text)) { console.error(`✗ Migración V14 no incluye: ${text}`); failed = true; }
}

const runtime = fs.readFileSync(path.join(root, "livevoz-v11-runtime.js"), "utf8");
if (!runtime.includes("sb_publishable_")) console.warn("! No se encontró una publishable key de Supabase en el runtime");
if (runtime.includes("service_role") || runtime.includes("sb_secret_")) { console.error("✗ Se detectó una credencial secreta que no debe estar en el cliente"); failed = true; }

if (failed) { console.error("\nLiveVoz check: FALLÓ"); process.exit(1); }
console.log("\nLiveVoz check: OK");