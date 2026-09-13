"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

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
  "livevoz-v14-1-polish.js",
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
function fail(message){ console.error(`✗ ${message}`); failed = true; }
function read(file){ return fs.readFileSync(path.join(root,file),"utf8"); }

for (const file of required) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) fail(`Falta ${file}`);
  else {
    const stat = fs.statSync(full);
    if (!stat.size) fail(`${file} está vacío`);
    else console.log(`✓ ${file} (${stat.size} bytes)`);
  }
}

for (const file of [
  "livevoz-v11-runtime.js","livevoz-v13-bridge.js","livevoz-v13-2-sync.js","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","sw.js","stage-server.cjs","electron-main.cjs","livevoz-v13-preload.cjs","scripts/check-stage-network.cjs"
]) {
  try {
    execFileSync(process.execPath,["--check",path.join(root,file)],{stdio:"pipe"});
    console.log(`✓ Sintaxis ${file}`);
  } catch (error) {
    fail(`Error de sintaxis en ${file}: ${String(error.stderr||error.message).trim()}`);
  }
}

const html = read("teleprompter-v11.html");
for (const ref of ["./teleprompter.html","./livevoz-v11-runtime.js","./livevoz-v13-bridge.js","./livevoz-v13-2-sync.js","./livevoz-v14-runtime.js","./livevoz-v14-cloud.js","./livevoz-v14-1-polish.js"]) {
  if (!html.includes(ref)) fail(`teleprompter-v11.html no referencia ${ref}`);
}
if (!html.includes("V14.1")) fail("Wrapper no identifica V14.1");

const stagePanel = read("livevoz-v13-stage.html");
for (const text of ["V14.1","Modo concierto","Generar QR","Preflight","Músicos y dispositivos","battery","Pantalla externa","openStageDisplay","Sincronizar","protocolPill","BATERÍA BAJA","RETRASO"]) {
  if (!stagePanel.includes(text)) fail(`Panel Stage no incluye: ${text}`);
}

const preload = read("livevoz-v13-preload.cjs");
for (const text of ["openStageDisplay","closeStageDisplay","livevoz:open-stage-display"]) if (!preload.includes(text)) fail(`Preload no incluye: ${text}`);

const bridge = read("livevoz-v13-bridge.js");
for (const text of ["LIVEVOZ_V13_STAGE_CONTEXT","LIVEVOZ_V13_SET_STAGE_CONFIG","livevoz_stage_session_room"]) if (!bridge.includes(text)) fail(`Bridge no incluye: ${text}`);

const sync = read("livevoz-v13-2-sync.js");
for (const text of ["livevoz_stage_session_room","concertSongIds","lineText","lineChords","connectWebSocket"]) if (!sync.includes(text)) fail(`Sync base no incluye: ${text}`);

const v14 = read("livevoz-v14-runtime.js");
for (const text of ["Stage Director","PRELOAD","COUNTDOWN","LOCK_STAGE","PRIVATE_NOTE","DEVICE_TELEMETRY","STAGE_MODE","requestMIDIAccess","wakeLock","Preflight","Serenata","instrumentNotes"]) if (!v14.toLowerCase().includes(text.toLowerCase())) fail(`Runtime V14 no incluye: ${text}`);

const polish = read("livevoz-v14-1-polish.js");
for (const text of ["14.1","RESYNC_REQUEST","último estado recuperado","reconexión","modo supervivencia","Resincronizar","DEVICE_PROFILE","livevoz_v14_1_last_state"]) if (!polish.includes(text)) fail(`Capa V14.1 no incluye: ${text}`);

const cloud = read("livevoz-v14-cloud.js");
for (const text of ["share_concert_by_email","song_instrument_parts","Administrador","Operador","Exportar reporte","sb_publishable_"]) if (!cloud.includes(text)) fail(`Cloud V14 no incluye: ${text}`);
if (cloud.includes("service_role") || cloud.includes("sb_secret_")) fail("Cloud V14 contiene una credencial secreta");

const electronMain = read("electron-main.cjs");
for (const ref of ["livevoz-v13-stage.html","livevoz-v13-preload.cjs","livevoz:start-stage","QRCode.toDataURL","openStageDisplay","screen.getAllDisplays","midiSysex"]) if (!electronMain.includes(ref)) fail(`electron-main.cjs no integra ${ref}`);

const stageServer = read("stage-server.cjs");
for (const text of ['PROTOCOL_VERSION = "14.1"',"DEVICE_PROFILE","DEVICE_TELEMETRY","PRIVATE_NOTE","COUNTDOWN","PRELOAD","LOCK_STAGE","STAGE_MODE","RESYNC_REQUEST",'"/app"',"livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","reconnectReplacements","resyncRequests"]) if (!stageServer.includes(text)) fail(`Stage Network V14.1 no incluye: ${text}`);
if (stageServer.includes('url.pathname==="/invite"')) fail("Stage Network conserva el endpoint de invitación regresivo");

const mobile = read("livevoz-mobile-v13-2.html");
for (const text of ["Entrar a LiveVoz completo","stageRoom","Trompeta en Sib","Saxofón alto en Mib","Bajo quinto"]) if (!mobile.includes(text)) fail(`Cliente móvil no incluye: ${text}`);

const manifest = read("manifest.webmanifest");
if (!manifest.includes('"./app"')) fail("Manifest no apunta a /app");
const sw = read("sw.js");
for (const text of ["livevoz-teleprompter-v14-1","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js"]) if (!sw.includes(text)) fail(`Service Worker no incluye: ${text}`);

const migration = read("supabase/migrations/20260913093000_livevoz_v14_stage_director.sql");
for (const text of ["device_profiles","song_instrument_parts","event_runs","admin","operator"]) if (!migration.includes(text)) fail(`Migración V14 no incluye: ${text}`);

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "14.1.0") fail(`package.json tiene versión ${pkg.version}, se esperaba 14.1.0`);
if (!pkg.build?.files?.includes("livevoz-v14-1-polish.js")) fail("Build no incluye livevoz-v14-1-polish.js");

const runtime = read("livevoz-v11-runtime.js");
if (!runtime.includes("sb_publishable_")) console.warn("! No se encontró una publishable key de Supabase en el runtime");
if (runtime.includes("service_role") || runtime.includes("sb_secret_")) fail("Se detectó una credencial secreta que no debe estar en el cliente");

if (failed) { console.error("\nLiveVoz V14.1 check: FALLÓ"); process.exit(1); }
console.log("\nLiveVoz V14.1 check: OK");