"use strict";
const http = require("node:http");
const crypto = require("node:crypto");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.LIVEVOZ_WS_PORT || 8080);
const HOST = process.env.LIVEVOZ_WS_HOST || "0.0.0.0";
const MAX_MESSAGE_BYTES = 64 * 1024;
const HEARTBEAT_MS = 15000;
const CLIENT_TIMEOUT_MS = 45000;
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CLIENTS_PER_ROOM = Number(process.env.LIVEVOZ_MAX_CLIENTS_PER_ROOM || 40);
const MAX_CLIENTS_PER_IP = Number(process.env.LIVEVOZ_MAX_CLIENTS_PER_IP || 12);
const PROTOCOL_VERSION = "13.0";
const rooms = new Map();
const ipCounters = new Map();
const metrics = {connections:0,messages:0,rejected:0,roomsCreated:0,startTime:Date.now()};

function safeText(value, max=120){ return typeof value === "string" ? value.slice(0,max) : ""; }
function escapeHtml(value){ return safeText(value,160).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
function now(){ return Date.now(); }
function hashToken(token){ return crypto.createHash("sha256").update(token || "").digest("hex"); }
function clientIp(req){ return safeText((req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown",128); }
function getRoom(name, token){
  if(!rooms.has(name)){
    rooms.set(name,{clients:new Set(),tokenHash:hashToken(token),lastState:null,createdAt:now(),updatedAt:now()});
    metrics.roomsCreated++;
  }
  return rooms.get(name);
}
function incIp(ip){ ipCounters.set(ip,(ipCounters.get(ip)||0)+1); }
function decIp(ip){ const next=Math.max(0,(ipCounters.get(ip)||1)-1); if(next===0)ipCounters.delete(ip); else ipCounters.set(ip,next); }
function leaveRoom(ws){
  const room = ws.livevozRoom && rooms.get(ws.livevozRoom);
  if(room){ room.clients.delete(ws); room.updatedAt=now(); }
  if(ws.livevozIp) decIp(ws.livevozIp);
}
function send(ws,obj){ if(ws.readyState===WebSocket.OPEN){ try{ws.send(JSON.stringify(obj));}catch(_e){} } }
function relay(room,sender,message){
  const encoded=JSON.stringify(message);
  if(Buffer.byteLength(encoded)>MAX_MESSAGE_BYTES)return;
  for(const peer of room.clients){ if(peer!==sender && peer.readyState===WebSocket.OPEN) peer.send(encoded); }
}
function closeWith(ws,code,reason){ metrics.rejected++; try{ws.close(code,reason);}catch(_e){} }
function roomSummary(){
  return [...rooms.entries()].map(([id,r])=>({
    id,
    clients:r.clients.size,
    ageSeconds:Math.round((now()-r.createdAt)/1000),
    idleSeconds:Math.round((now()-r.updatedAt)/1000),
    hasState:!!r.lastState,
    devices:[...r.clients].map(ws=>({device:ws.livevozDevice,role:ws.livevozRole,lastSeen:ws.lastSeen,connected:true}))
  }));
}

function joinPage(){
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090d">
<title>LiveVoz Stage Mobile</title>
<style>
:root{color-scheme:dark;--bg:#07090d;--panel:#11151d;--line:#283142;--muted:#9ca7ba;--ok:#60d69a;--bad:#ff6f7d;--accent:#2f78ff;--yellow:#f1c40f}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;min-height:100vh}.wrap{width:min(94vw,620px);margin:auto;padding:26px 0 40px}.card{background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3)}h1{margin:0 0 8px;font-size:clamp(2rem,8vw,3rem)}.sub{color:var(--muted);margin:0 0 20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.box{background:#090d13;border:1px solid #222c3a;border-radius:12px;padding:12px}.box small{display:block;color:var(--muted);font-size:.72rem}.box b{display:block;margin-top:4px;word-break:break-word}label{display:block;color:#c8d0dd;font-size:.82rem;margin:14px 0 6px}input,select{width:100%;background:#090d13;color:#fff;border:1px solid #303b4d;border-radius:11px;padding:13px;font:inherit}button{width:100%;border:0;border-radius:12px;padding:14px;font:800 1rem system-ui;cursor:pointer;margin-top:16px;background:var(--accent);color:#fff}.secondary{background:#1b2330;border:1px solid #344054}.status{margin-top:16px;padding:12px;border-radius:11px;background:#0a0f16;color:var(--muted);border:1px solid #252f3d}.status.ok{color:var(--ok);border-color:#275b46}.status.bad{color:var(--bad);border-color:#63323a}.hidden{display:none}.live{min-height:68vh;display:flex;flex-direction:column}.topline{display:flex;align-items:center;justify-content:space-between;gap:12px}.badge{font-size:.72rem;padding:6px 9px;border-radius:999px;background:#0b3426;color:var(--ok)}.song{margin:auto 0;text-align:center}.song small{color:var(--muted);text-transform:uppercase;letter-spacing:.14em}.song h2{font-size:clamp(2rem,10vw,4rem);margin:12px 0}.line{font-size:clamp(1.5rem,7vw,2.6rem);color:var(--yellow);font-weight:900;margin-top:18px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:20px}.stat{background:#090d13;border:1px solid #222c3a;border-radius:10px;padding:10px;text-align:center}.stat small{display:block;color:var(--muted);font-size:.65rem}.stat b{display:block;margin-top:4px}.hint{color:var(--muted);font-size:.78rem;margin-top:14px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <section class="card" id="joinView">
    <h1>LiveVoz Stage</h1>
    <p class="sub">Conéctate directamente al escenario desde tu teléfono.</p>
    <div class="meta"><div class="box"><small>Sala</small><b id="roomText">—</b></div><div class="box"><small>PIN</small><b id="pinText">—</b></div></div>
    <label for="name">Tu nombre</label>
    <input id="name" maxlength="60" placeholder="Ej. Carlos">
    <label for="role">Vista / rol</label>
    <select id="role"><option value="singer">🎤 Cantante</option><option value="musician">🎸 Músico</option><option value="hybrid">🎼 Letra + acordes</option></select>
    <button id="joinBtn">Entrar al escenario</button>
    <div class="status" id="status">Listo para conectar.</div>
  </section>

  <section class="card live hidden" id="liveView">
    <div class="topline"><div><b>LiveVoz Stage</b><div style="color:var(--muted);font-size:.75rem" id="identity"></div></div><span class="badge" id="liveBadge">CONECTADO</span></div>
    <div class="song"><small id="concertName">Concierto</small><h2 id="songTitle">Esperando al operador…</h2><div class="line" id="lineText">La información del escenario aparecerá aquí.</div></div>
    <div class="stats"><div class="stat"><small>Tono</small><b id="keyText">—</b></div><div class="stat"><small>BPM</small><b id="bpmText">—</b></div><div class="stat"><small>Línea</small><b id="lineIndex">—</b></div></div>
    <button class="secondary" id="leaveBtn">Salir del escenario</button><div class="hint">Mantén esta pantalla abierta durante la presentación.</div>
  </section>
</div>
<script>
(()=>{
  const q=new URLSearchParams(location.search);const room=q.get('room')||'livevoz-stage';const token=q.get('token')||'';
  const $=id=>document.getElementById(id);$('roomText').textContent=room;$('pinText').textContent=token||'Sin PIN';
  let ws=null,seq=0;const savedName=localStorage.getItem('livevoz_mobile_name')||'';const savedRole=localStorage.getItem('livevoz_mobile_role')||'singer';$('name').value=savedName;$('role').value=savedRole;
  const deviceId=localStorage.getItem('livevoz_mobile_device')||('mobile-'+Math.random().toString(36).slice(2,10));localStorage.setItem('livevoz_mobile_device',deviceId);
  function status(text,kind=''){const el=$('status');el.textContent=text;el.className='status '+kind;}
  function envelope(type,payload,role){return{type,payload,messageId:deviceId+':'+Date.now().toString(36)+':'+(++seq),senderId:deviceId,senderRole:role,roomId:room,timestamp:Date.now(),sequence:seq,version:'13.0'};}
  function send(type,payload,role){if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(envelope(type,payload,role)));}
  function renderState(p){if(!p||typeof p!=='object')return;$('concertName').textContent=p.concertName||'Concierto';$('songTitle').textContent=p.songTitle||p.title||(p.songIndex!=null?'Canción '+(Number(p.songIndex)+1):'En vivo');$('lineText').textContent=p.lineText||p.lyric||'Sin texto recibido todavía';$('keyText').textContent=p.key||'—';$('bpmText').textContent=p.bpm||'—';$('lineIndex').textContent=Number.isInteger(p.lineIndex)?String(p.lineIndex+1):'—';}
  function showLive(name,role){$('joinView').classList.add('hidden');$('liveView').classList.remove('hidden');$('identity').textContent=name+' · '+role;}
  function showJoin(){ $('liveView').classList.add('hidden');$('joinView').classList.remove('hidden'); }
  function connect(){const name=$('name').value.trim();const role=$('role').value;if(!name){status('Escribe tu nombre para entrar.','bad');return;}localStorage.setItem('livevoz_mobile_name',name);localStorage.setItem('livevoz_mobile_role',role);status('Conectando…');const proto=location.protocol==='https:'?'wss:':'ws:';const endpoint=new URL(proto+'//'+location.host+'/');endpoint.searchParams.set('room',room);endpoint.searchParams.set('token',token);endpoint.searchParams.set('device',deviceId);endpoint.searchParams.set('role',role);endpoint.searchParams.set('v','13.0');try{ws=new WebSocket(endpoint.toString());}catch(e){status('No se pudo abrir Stage Network.','bad');return;}
    ws.onopen=()=>{status('Conectado.','ok');showLive(name,role);send('DEVICE_JOIN',{deviceId,name,role},role);};
    ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.type==='STATE')renderState(m.payload);if(m.type==='WELCOME')$('liveBadge').textContent='CONECTADO';}catch(_e){}};
    ws.onerror=()=>status('Error de conexión con Stage Network.','bad');
    ws.onclose=e=>{ws=null;$('liveBadge').textContent='DESCONECTADO';if(e.code===4001)status('PIN incorrecto o sala no válida. Genera un QR nuevo.','bad');else status('Se perdió la conexión. Puedes volver a entrar.','bad');showJoin();};
  }
  $('joinBtn').onclick=connect;$('leaveBtn').onclick=()=>{const role=$('role').value;send('DEVICE_LEAVE',{deviceId},role);try{ws&&ws.close(1000,'mobile-leave');}catch(_e){}ws=null;showJoin();status('Desconectado.');};
})();
</script>
</body>
</html>`;
}

const server=http.createServer((req,res)=>{
  const headers={"cache-control":"no-store","access-control-allow-origin":"*"};
  const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`);
  if(url.pathname==="/health"){
    res.writeHead(200,{...headers,"content-type":"application/json"});
    return res.end(JSON.stringify({ok:true,service:"livevoz-stage-network",protocol:PROTOCOL_VERSION,uptimeSeconds:Math.round(process.uptime()),rooms:rooms.size,clients:[...rooms.values()].reduce((n,r)=>n+r.clients.size,0)}));
  }
  if(url.pathname==="/metrics"){
    res.writeHead(200,{...headers,"content-type":"application/json"});
    return res.end(JSON.stringify({...metrics,uptimeSeconds:Math.round((now()-metrics.startTime)/1000),activeRooms:roomSummary()}));
  }
  if(url.pathname==="/join"){
    res.writeHead(200,{...headers,"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ws: wss:; img-src data:"});
    return res.end(joinPage());
  }
  res.writeHead(200,{...headers,"content-type":"text/plain; charset=utf-8"});
  res.end(`LiveVoz Stage Network v${PROTOCOL_VERSION}\nHealth: /health\nMetrics: /metrics\nJoin: /join\n`);
});

const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE_BYTES,perMessageDeflate:false,clientTracking:true});
wss.on("connection",(ws,req)=>{
  const base=`http://${req.headers.host || "localhost"}`;
  const url=new URL(req.url||"/",base);
  const roomId=safeText(url.searchParams.get("room")||"livevoz-default",128);
  const token=safeText(url.searchParams.get("token")||"",64);
  const device=safeText(url.searchParams.get("device")||"unknown",120);
  const role=safeText(url.searchParams.get("role")||"unknown",24);
  const protocol=safeText(url.searchParams.get("protocol")||url.searchParams.get("v")||"",16);
  const ip=clientIp(req);

  if(!roomId || !device) return closeWith(ws,1008,"invalid-client");
  if((ipCounters.get(ip)||0)>=MAX_CLIENTS_PER_IP) return closeWith(ws,4003,"ip-limit");
  const room=getRoom(roomId,token);
  const incomingTokenHash=hashToken(token);
  if(room.tokenHash!==incomingTokenHash && room.clients.size===0 && room.tokenHash===hashToken("") && token){
    room.tokenHash=incomingTokenHash;
    room.updatedAt=now();
  }
  if(room.clients.size>=MAX_CLIENTS_PER_ROOM) return closeWith(ws,4002,"room-full");
  if(room.tokenHash!==incomingTokenHash) return closeWith(ws,4001,"invalid-room-token");

  ws.livevozRoom=roomId; ws.livevozDevice=device; ws.livevozRole=role; ws.livevozIp=ip; ws.isAlive=true; ws.lastSeen=now();
  room.clients.add(ws); room.updatedAt=now(); incIp(ip); metrics.connections++;

  send(ws,{type:"WELCOME",payload:{protocol:PROTOCOL_VERSION,roomId,serverTime:now(),compatible:!protocol || protocol.startsWith("13") || protocol.startsWith("12") || protocol.startsWith("11")},timestamp:now(),messageId:`server:${crypto.randomUUID()}`,senderId:"server",senderRole:"server",roomId});
  if(room.lastState)send(ws,room.lastState);

  ws.on("pong",()=>{ws.isAlive=true;ws.lastSeen=now();});
  ws.on("message",raw=>{
    ws.lastSeen=now(); room.updatedAt=now(); metrics.messages++;
    if(raw.length>MAX_MESSAGE_BYTES)return closeWith(ws,1009,"message-too-large");
    let msg; try{msg=JSON.parse(raw.toString("utf8"));}catch(_e){return;}
    if(!msg || typeof msg!=="object")return;
    if(msg.roomId!==roomId) return;
    if(msg.senderId!==device || msg.senderRole!==role) return;
    const allowed=new Set(["STATE","COMMAND","PING","PONG","DEVICE_JOIN","DEVICE_LEAVE"]);
    if(!allowed.has(msg.type))return;
    if(msg.type==="COMMAND" && role!=="operator")return;
    if(msg.type==="STATE" && role==="operator") room.lastState=msg;
    relay(room,ws,msg);
  });
  ws.on("close",()=>leaveRoom(ws));
  ws.on("error",()=>leaveRoom(ws));
});

const heartbeat=setInterval(()=>{
  const t=now();
  for(const [roomId,room] of rooms){
    for(const ws of room.clients){
      if(!ws.isAlive || t-ws.lastSeen>CLIENT_TIMEOUT_MS){try{ws.terminate();}catch(_e){} continue;}
      ws.isAlive=false;try{ws.ping();}catch(_e){}
    }
    if(room.clients.size===0 && t-room.updatedAt>ROOM_TTL_MS) rooms.delete(roomId);
  }
},HEARTBEAT_MS);
heartbeat.unref();

server.on("error",(error)=>{
  if(error?.code==="EADDRINUSE") console.error(`LiveVoz Stage Network: el puerto ${PORT} ya está en uso.`);
  else console.error("LiveVoz Stage Network:",error);
});
server.listen(PORT,HOST,()=>console.log(`LiveVoz Stage Network v${PROTOCOL_VERSION} escuchando en ws://${HOST}:${PORT}`));
process.on("SIGINT",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
process.on("SIGTERM",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
