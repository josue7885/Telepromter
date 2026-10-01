"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "teleprompter.html","teleprompter-v11.html","livevoz-v11-runtime.js","livevoz-v13-stage.html","livevoz-v13-preload.cjs","livevoz-v13-bridge.js","livevoz-v13-2-sync.js","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js","livevoz-v14-3-run-order.js","livevoz-v14-4-block-run-order.js","livevoz-v15-professional.js","livevoz-v15-operator-safety.js","livevoz-mobile-v13-1.html","livevoz-mobile-v13-2.html","stage-server.cjs","electron-main.cjs","manifest.webmanifest","sw.js","livevoz-logo.png","supabase/migrations/20260912022000_livevoz_v11.sql","supabase/migrations/20260913093000_livevoz_v14_stage_director.sql","supabase/migrations/20260913105500_livevoz_v14_2_core_workflow.sql"
];
let failed=false;
function fail(m){console.error(`✗ ${m}`);failed=true}
function read(f){return fs.readFileSync(path.join(root,f),"utf8")}
for(const file of required){const full=path.join(root,file);if(!fs.existsSync(full))fail(`Falta ${file}`);else if(!fs.statSync(full).size)fail(`${file} está vacío`);else console.log(`✓ ${file}`)}

for(const file of ["livevoz-v11-runtime.js","livevoz-v13-bridge.js","livevoz-v13-2-sync.js","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js","livevoz-v14-3-run-order.js","livevoz-v14-4-block-run-order.js","livevoz-v15-professional.js","livevoz-v15-operator-safety.js","sw.js","stage-server.cjs","electron-main.cjs","livevoz-v13-preload.cjs","scripts/check-stage-network.cjs"]){try{execFileSync(process.execPath,["--check",path.join(root,file)],{stdio:"pipe"});console.log(`✓ Sintaxis ${file}`)}catch(error){fail(`Error de sintaxis en ${file}: ${String(error.stderr||error.message).trim()}`)}}

const wrapper=read("teleprompter-v11.html");
for(const ref of ["livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js","livevoz-v14-3-run-order.js","livevoz-v14-4-block-run-order.js","livevoz-v15-professional.js","livevoz-v15-operator-safety.js"])if(!wrapper.includes(ref))fail(`Wrapper no carga ${ref}`);
if(!wrapper.includes("V15"))fail("Wrapper no identifica V15");

const workspace=read("livevoz-v14-2-workspace.js");
for(const text of ["Centro de trabajo","Biblioteca","Editor","Setlist","Perfiles del grupo","Notas personales","Modo ensayo","Historial","Respaldo local","cloudBackup","STATE_ACK","stateRevision","musician"]){if(!workspace.includes(text))fail(`Workspace V14.2 no incluye: ${text}`)}
if(workspace.includes("service_role")||workspace.includes("sb_secret_"))fail("Workspace V14.2 contiene credencial secreta");

const polish=read("livevoz-v14-1-polish.js");
for(const text of ["14.1","RESYNC_REQUEST","modo supervivencia","Resincronizar"])if(!polish.includes(text))fail(`Capa V14.1 no incluye: ${text}`);

const server=read("stage-server.cjs");
for(const text of ['PROTOCOL_VERSION = "15.0"',"STATE_ACK","stateAcks","lastAckRevision","RESYNC_REQUEST","livevoz-v14-2-workspace.js","livevoz-v15-professional.js","livevoz-v15-operator-safety.js"]){if(!server.includes(text))fail(`Stage Network V15 no incluye: ${text}`)}
if(server.includes('url.pathname==="/invite"'))fail("Stage Network conserva endpoint /invite regresivo");

const sw=read("sw.js");
for(const text of ["livevoz-teleprompter-v15","livevoz-v15-professional.js","livevoz-v15-operator-safety.js"])if(!sw.includes(text))fail(`Service Worker V15 no incluye: ${text}`);

const migration=read("supabase/migrations/20260913105500_livevoz_v14_2_core_workflow.sql");
for(const text of ["musician_profiles","personal_song_notes","rehearsal_sessions","rehearsal_song_status","concert_activity","pg_trgm"]){if(!migration.includes(text))fail(`Migración V14.2 no incluye: ${text}`)}

const pkg=JSON.parse(read("package.json"));
if(pkg.version!=="15.0.0")fail(`package.json tiene ${pkg.version}; se esperaba 15.0.0`);
for(const file of ["livevoz-v14-2-workspace.js","livevoz-v14-4-block-run-order.js","livevoz-v15-professional.js","livevoz-v15-operator-safety.js"])if(!pkg.build?.files?.includes(file))fail(`Build no incluye ${file}`);

const runtime=read("livevoz-v11-runtime.js");
if(runtime.includes("service_role")||runtime.includes("sb_secret_"))fail("Se detectó una credencial secreta en runtime");

if(failed){console.error("\nLiveVoz V15 check: FALLÓ");process.exit(1)}
console.log("\nLiveVoz V15 check: OK");