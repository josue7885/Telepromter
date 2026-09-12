"use strict";
const http = require("node:http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.LIVEVOZ_WS_PORT || 8080);
const HOST = process.env.LIVEVOZ_WS_HOST || "0.0.0.0";
const MAX_MESSAGE_BYTES = 64 * 1024;
const HEARTBEAT_MS = 15000;
const CLIENT_TIMEOUT_MS = 45000;
const rooms = new Map();

function safeText(value, max=120){ return typeof value === "string" ? value.slice(0,max) : ""; }
function getRoom(name){
  if(!rooms.has(name)) rooms.set(name,{clients:new Set(),token:null,lastState:null});
  return rooms.get(name);
}
function leaveRoom(ws){
  const room = ws.livevozRoom && rooms.get(ws.livevozRoom);
  if(!room) return;
  room.clients.delete(ws);
  if(room.clients.size===0) rooms.delete(ws.livevozRoom);
}
function send(ws,obj){
  if(ws.readyState!==WebSocket.OPEN) return;
  try{ws.send(JSON.stringify(obj));}catch(_e){}
}
function relay(room,sender,message){
  const encoded=JSON.stringify(message);
  if(Buffer.byteLength(encoded)>MAX_MESSAGE_BYTES)return;
  for(const peer of room.clients){ if(peer!==sender && peer.readyState===WebSocket.OPEN) peer.send(encoded); }
}

const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});
    return res.end(JSON.stringify({ok:true,service:"livevoz-stage-network",rooms:rooms.size,clients:[...rooms.values()].reduce((n,r)=>n+r.clients.size,0)}));
  }
  res.writeHead(200,{"content-type":"text/plain; charset=utf-8","cache-control":"no-store"});
  res.end("LiveVoz Stage Network WebSocket Server\n");
});

const wss=new WebSocketServer({server,maxPayload:MAX_MESSAGE_BYTES,perMessageDeflate:false});
wss.on("connection",(ws,req)=>{
  const base=`http://${req.headers.host || "localhost"}`;
  const url=new URL(req.url||"/",base);
  const roomId=safeText(url.searchParams.get("room")||"livevoz-default",128);
  const token=safeText(url.searchParams.get("token")||"",64);
  const device=safeText(url.searchParams.get("device")||"unknown",120);
  const role=safeText(url.searchParams.get("role")||"unknown",24);
  if(!roomId){ws.close(1008,"room-required");return;}
  const room=getRoom(roomId);
  if(room.token===null) room.token=token;
  if(room.token!==token){ws.close(4001,"invalid-room-token");return;}

  ws.livevozRoom=roomId; ws.livevozDevice=device; ws.livevozRole=role; ws.isAlive=true; ws.lastSeen=Date.now();
  room.clients.add(ws);
  ws.on("pong",()=>{ws.isAlive=true;ws.lastSeen=Date.now();});
  ws.on("message",raw=>{
    ws.lastSeen=Date.now();
    if(raw.length>MAX_MESSAGE_BYTES)return;
    let msg; try{msg=JSON.parse(raw.toString("utf8"));}catch(_e){return;}
    if(!msg || typeof msg!=="object")return;
    if(msg.roomId!==roomId || safeText(msg.roomToken,64)!==room.token)return;
    if(msg.senderId!==device)return;
    if(msg.senderRole!==role)return;
    const allowed=new Set(["STATE","COMMAND","PING","PONG","DEVICE_JOIN","DEVICE_LEAVE"]);
    if(!allowed.has(msg.type))return;
    if(msg.type==="COMMAND" && role!=="operator")return;
    if(msg.type==="STATE" && role==="operator")room.lastState=msg;
    relay(room,ws,msg);
  });
  ws.on("close",()=>leaveRoom(ws));
  ws.on("error",()=>leaveRoom(ws));
  if(room.lastState)send(ws,room.lastState);
});

const heartbeat=setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    for(const ws of room.clients){
      if(!ws.isAlive || now-ws.lastSeen>CLIENT_TIMEOUT_MS){try{ws.terminate();}catch(_e){} continue;}
      ws.isAlive=false;try{ws.ping();}catch(_e){}
    }
  }
},HEARTBEAT_MS);
heartbeat.unref();

server.listen(PORT,HOST,()=>console.log(`LiveVoz Stage Network escuchando en ws://${HOST}:${PORT}`));
process.on("SIGINT",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
process.on("SIGTERM",()=>{clearInterval(heartbeat);wss.close(()=>server.close(()=>process.exit(0)));});
