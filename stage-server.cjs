"use strict";
const fs = require("node:fs");
const path = require("node:path");
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
const PROTOCOL_VERSION = "13.1";
const rooms = new Map();
const ipCounters = new Map();
const metrics = {connections:0,messages:0,rejected:0,roomsCreated:0,startTime:Date.now()};
const mobilePath = path.join(__dirname,"livevoz-mobile-v13-1.html");

function safeText(value,max=120){return typeof value==="string"?value.slice(0,max):"";}
function safeTranspose(value){return Math.max(-12,Math.min(12,Math.round(Number(value)||0)));}
function now(){return Date.now();}
function hashToken(token){return crypto.createHash("sha256").update(token||"").digest("hex");}
function clientIp(req){return safeText((req.headers["x-forwarded-for"]||"").split(",")[0].trim()||req.socket.remoteAddress||"unknown",128);}
function getRoom(name,token){if(!rooms.has(name)){rooms.set(name,{clients:new Set(),tokenHash:hashToken(token),lastState:null,createdAt:now(),updatedAt:now()});metrics.roomsCreated++;}return rooms.get(name);}
function incIp(ip){ipCounters.set(ip,(ipCounters.get(ip)||0)+1);}
function decIp(ip){const next=Math.max(0,(ipCounters.get(ip)||1)-1);if(next===0)ipCounters.delete(ip);else ipCounters.set(ip,next);}
function leaveRoom(ws){const room=ws.livevozRoom&&rooms.get(ws.livevozRoom);if(room){room.clients.delete(ws);room.updatedAt=now();}if(ws.livevozIp)decIp(ws.livevozIp);}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify(obj));}catch(_e){}}}
function relay(room,sender,message){const encoded=JSON.stringify(message);if(Buffer.byteLength(encoded)>MAX_MESSAGE_BYTES)return;for(const peer of room.clients){if(peer!==sender&&peer.readyState===WebSocket.OPEN)peer.send(encoded);}}
function closeWith(ws,code,reason){metrics.rejected++;try{ws.close(code,reason);}catch(_e){}}
function applyProfile(ws,payload={}){if(typeof payload.name==="string")ws.livevozName=safeText(payload.name,60);if(typeof payload.instrument==="string")ws.livevozInstrument=safeText(payload.instrument,40);if(payload.transpose!==undefined)ws.livevozTranspose=safeTranspose(payload.transpose);if(typeof payload.role==="string")ws.livevozRole=safeText(payload.role,24);}
function roomSummary(){return [...rooms.entries()].map(([id,r])=>({id,clients:r.clients.size,ageSeconds:Math.round((now()-r.createdAt)/1000),idleSeconds:Math.round((now()-r.updatedAt)/1000),hasState:!!r.lastState,devices:[...r.clients].map(ws=>({device:ws.livevozDevice,name:ws.livevozName||"",role:ws.livevozRole,instrument:ws.livevozInstrument||"",transpose:safeTranspose(ws.livevozTranspose),lastSeen:ws.lastSeen,connected:true}))}));}

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
    try{
      const html=fs.readFileSync(mobilePath,"utf8");
      res.writeHead(200,{...headers,"content-type":"text/html; charset=utf-8","content-security-policy":"default-src 'self' 'unsafe-inline' data:; connect-src ws: wss: http: https:;"});
      return res.end(html);
    }catch(_e){
      res.writeHead(500,{...headers,"content-type":"text/plain; charset=utf-8"});
      return res.end("LiveVoz Mobile no está disponible. Ejecuta npm run check.");
    }
  }
  res.writeHead(200,{...headers,"content-type":"text/plain; charset=utf-8"});
  res.end(`LiveVoz Stage Network v${PROTOCOL_VERSION}\nHealth: /health\nMetrics: /metrics\nJoin: /join\n`);
});

const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE_BYTES,perMessageDeflate:false,clientTracking:true});
wss.on("connection",(ws,req)=>{
  const base=`http://${req.headers.host||"localhost"}`;
  const url=new URL(req.url||"/",base);
  const roomId=safeText(url.searchParams.get("room")||"livevoz-default",128);
  const token=safeText(url.searchParams.get("token")||"",64);
  const device=safeText(url.searchParams.get("device")||"unknown",120);
  const role=safeText(url.searchParams.get("role")||"unknown",24);
  const name=safeText(url.searchParams.get("name")||"",60);
  const instrument=safeText(url.searchParams.get("instrument")||"",40);
  const transpose=safeTranspose(url.searchParams.get("transpose"));
  const protocol=safeText(url.searchParams.get("protocol")||url.searchParams.get("v")||"",16);
  const ip=clientIp(req);

  if(!roomId||!device)return closeWith(ws,1008,"invalid-client");
  if((ipCounters.get(ip)||0)>=MAX_CLIENTS_PER_IP)return closeWith(ws,4003,"ip-limit");
  const room=getRoom(roomId,token);
  const incomingTokenHash=hashToken(token);
  if(room.tokenHash!==incomingTokenHash&&room.clients.size===0&&room.tokenHash===hashToken("")&&token){room.tokenHash=incomingTokenHash;room.updatedAt=now();}
  if(room.clients.size>=MAX_CLIENTS_PER_ROOM)return closeWith(ws,4002,"room-full");
  if(room.tokenHash!==incomingTokenHash)return closeWith(ws,4001,"invalid-room-token");

  ws.livevozRoom=roomId;ws.livevozDevice=device;ws.livevozRole=role;ws.livevozName=name;ws.livevozInstrument=instrument;ws.livevozTranspose=transpose;ws.livevozIp=ip;ws.isAlive=true;ws.lastSeen=now();
  room.clients.add(ws);room.updatedAt=now();incIp(ip);metrics.connections++;

  send(ws,{type:"WELCOME",payload:{protocol:PROTOCOL_VERSION,roomId,serverTime:now(),compatible:!protocol||protocol.startsWith("13")||protocol.startsWith("12")||protocol.startsWith("11")},timestamp:now(),messageId:`server:${crypto.randomUUID()}`,senderId:"server",senderRole:"server",roomId});
  if(room.lastState)send(ws,room.lastState);

  ws.on("pong",()=>{ws.isAlive=true;ws.lastSeen=now();});
  ws.on("message",raw=>{
    ws.lastSeen=now();room.updatedAt=now();metrics.messages++;
    if(raw.length>MAX_MESSAGE_BYTES)return closeWith(ws,1009,"message-too-large");
    let msg;try{msg=JSON.parse(raw.toString("utf8"));}catch(_e){return;}
    if(!msg||typeof msg!=="object")return;
    if(msg.roomId!==roomId)return;
    if(msg.senderId!==device||msg.senderRole!==ws.livevozRole)return;
    const allowed=new Set(["STATE","COMMAND","PING","PONG","DEVICE_JOIN","DEVICE_LEAVE","DEVICE_PROFILE"]);
    if(!allowed.has(msg.type))return;
    if(msg.type==="COMMAND"&&ws.livevozRole!=="operator")return;
    if(["DEVICE_JOIN","DEVICE_PROFILE","PING","PONG"].includes(msg.type))applyProfile(ws,msg.payload||{});
    if(msg.type==="STATE"&&ws.livevozRole==="operator")room.lastState=msg;
    relay(room,ws,msg);
  });
  ws.on("close",()=>leaveRoom(ws));
  ws.on("error",()=>leaveRoom(ws));
});

const heartbeat=setInterval(()=>{const t=now();for(const [roomId,room]of rooms){for(const ws of room.clients){if(!ws.isAlive||t-ws.lastSeen>CLIENT_TIMEOUT_MS){try{ws.terminate();}catch(_e){}continue;}ws.isAlive=false;try{ws.ping();}catch(_e){}}if(room.clients.size===0&&t-room.updatedAt>ROOM_TTL_MS)rooms.delete(roomId);}},HEARTBEAT_MS);heartbeat.unref();

server.on("error",error=>{if(error?.code==="EADDRINUSE")console.error(`LiveVoz Stage Network: el puerto ${PORT} ya está en uso.`);else console.error("LiveVoz Stage Network:",error);});
server.listen(PORT,HOST,()=>console.log(`LiveVoz Stage Network v${PROTOCOL_VERSION} escuchando en ws://${HOST}:${PORT}`));
process.on("SIGINT",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
process.on("SIGTERM",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
