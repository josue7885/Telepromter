"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "teleprompter.html","teleprompter-v11.html","livevoz-v11-runtime.js","livevoz-v13-stage.html","livevoz-v13-preload.cjs","livevoz-v13-bridge.js","livevoz-v13-2-sync.js","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js","livevoz-mobile-v13-1.html","livevoz-mobile-v13-2.html","stage-server.cjs","electron-main.cjs","manifest.webmanifest","sw.js","livevoz-logo.png","supabase/migrations/20260912022000_livevoz_v11.sql","supabase/migrations/20260913093000_livevoz_v14_stage_director.sql","supabase/migrations/20260913105500_livevoz_v14_2_core_workflow.sql"
];
let failed=false;
function fail(m){console.error(`✗ ${m}`);failed=true}
function read(f){return fs.readFileSync(path.join(root,f),"utf8")}
for(const file of required){const full=path.join(root,file);if(!fs.existsSync(full))fail(`Falta ${file}`);else if(!fs.statSync(full).size)fail(`${file} está vacío`);else console.log(`✓ ${file}`)}

for(const file of ["livevoz-v11-runtime.js","livevoz-v13-bridge.js","livevoz-v13-2-sync.js","livevoz-v14-runtime.js","livevoz-v14-cloud.js","livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js","sw.js","stage-server.cjs","electron-main.cjs","livevoz-v13-preload.cjs","scripts/check-stage-network.cjs"]){try{execFileSync(process.execPath,["--check",path.join(root,file)],{stdio:"pipe"});console.log(`✓ Sintaxis ${file}`)}catch(error){fail(`Error de sintaxis en ${file}: ${String(error.stderr||error.message).trim()}`)}}

const wrapper=read("teleprompter-v11.html");
for(const ref of ["livevoz-v14-1-polish.js","livevoz-v14-2-workspace.js"])if(!wrapper.includes(ref))fail(`Wrapper no carga ${ref}`);
if(!wrapper.includes("V14.2"))fail("Wrapper no identifica V14.2");

const workspace=read("livevoz-v14-2-workspace.js");
for(const text of ["Centro de trabajo","Biblioteca","Editor","Setlist","Perfiles del grupo","Notas personales","Modo ensayo","Historial","Respaldo local","cloudBackup","STATE_ACK","stateRevision","musician"]){if(!workspace.includes(text))fail(`Workspace V14.2 no incluye: ${text}`)}
if(workspace.includes("service_role")||workspace.includes("sb_secret_"))fail("Workspace V14.2 contiene credencial secreta");

const polish=read("livevoz-v14-1-polish.js");
for(const text of ["14.1","RESYNC_REQUEST","modo supervivencia","Resincronizar"])if(!polish.includes(text))fail(`Capa V14.1 no incluye: ${text}`);

const server=read("stage-server.cjs");
for(const text of ['PROTOCOL_VERSION = "14.2"',"STATE_ACK","stateAcks","lastAckRevision","RESYNC_REQUEST","livevoz-v14-2-workspace.js"]){if(!server.includes(text))fail(`Stage Network V14.2 no incluye: ${text}`)}
if(server.includes('url.pathname==="/invite"'))fail("Stage Network conserva endpoint /invite regresivo");

const sw=read("sw.js");
for(const text of ["livevoz-teleprompter-v14-2","livevoz-v14-2-workspace.js"])if(!sw.includes(text))fail(`Service Worker V14.2 no incluye: ${text}`);

const migration=read("supabase/migrations/20260913105500_livevoz_v14_2_core_workflow.sql");
for(const text of ["musician_profiles","personal_song_notes","rehearsal_sessions","rehearsal_song_status","concert_activity","pg_trgm"]){if(!migration.includes(text))fail(`Migración V14.2 no incluye: ${text}`)}

const pkg=JSON.parse(read("package.json"));
if(pkg.version!=="14.2.0")fail(`package.json tiene ${pkg.version}; se esperaba 14.2.0`);
if(!pkg.build?.files?.includes("livevoz-v14-2-workspace.js"))fail("Build no incluye livevoz-v14-2-workspace.js");

const runtime=read("livevoz-v11-runtime.js");
if(runtime.includes("service_role")||runtime.includes("sb_secret_"))fail("Se detectó una credencial secreta en runtime");

if(failed){console.error("\nLiveVoz V14.2 check: FALLÓ");process.exit(1)}
console.log("\nLiveVoz V14.2 check: OK");