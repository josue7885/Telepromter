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

function joinPage(url){
  const room=escapeHtml(url.searchParams.get("room")||"livevoz-stage");
  const token=escapeHtml(url.searchParams.get("token")||"");
  const wsUrl=`ws://${escapeHtml(url.host)}/?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
  return `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LiveVoz Stage</title><style>body{margin:0;background:#07090d;color:#fff;font-family:system-ui;display:grid;place-items:center;min-height:100vh}.c{width:min(92vw,520px);background:#11151d;border:1px solid #2a3341;border-radius:18px;padding:24px}h1{margin-top:0}code{display:block;padding:12px;background:#080b10;border-radius:10px;word-break:break-all;color:#9fc1ff}.ok{color:#60d69a}.m{color:#9ca7ba}</style><div class="c"><h1>LiveVoz Stage</h1><p class="ok">Invitación válida para conectarte al escenario.</p><p><b>Sala:</b> ${room}</p><p><b>PIN:</b> ${token}</p><p class="m">En LiveVoz del teléfono usa esta dirección Stage Network:</p><code>${wsUrl}</code><p class="m">Mantén esta pantalla disponible mientras configuras tu dispositivo.</p></div></html>`;
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
    res.writeHead(200,{...headers,"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'"});
    return res.end(joinPage(url));
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
  if(room.clients.size>=MAX_CLIENTS_PER_ROOM) return closeWith(ws,4002,"room-full");
  if(room.tokenHash!==hashToken(token)) return closeWith(ws,4001,"invalid-room-token");

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

server.listen(PORT,HOST,()=>console.log(`LiveVoz Stage Network v${PROTOCOL_VERSION} escuchando en ws://${HOST}:${PORT}`));
process.on("SIGINT",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
process.on("SIGTERM",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
