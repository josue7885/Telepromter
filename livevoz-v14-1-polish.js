(()=>{
  "use strict";
  const VERSION="14.1";
  const ROOM_KEY="livevoz_stage_session_room";
  const TOKEN_KEY="livevoz_ws_room_token";
  const SNAPSHOT_KEY="livevoz_v14_1_last_state";
  const seen=new Map();
  let retry=0,retryTimer=null,heartbeatTimer=null,lastMessageAt=0,lastConnectAt=0,manualClose=false;

  const room=()=>String(localStorage.getItem(ROOM_KEY)||currentConcertId||concertName||"livevoz-default").trim();
  const token=()=>String(localStorage.getItem(TOKEN_KEY)||"").trim();
  const wsBase=()=>String(localStorage.getItem(STORAGE_KEYS.wsUrl)||"").trim();
  const instrument=()=>String(localStorage.getItem("livevoz_mobile_instrument")||"").trim();
  const transpose=()=>Math.max(-12,Math.min(12,Math.round(Number(localStorage.getItem("livevoz_mobile_transpose"))||0)));
  const now=()=>Date.now();
  function remember(id){if(!id)return false;if(seen.has(id))return true;seen.set(id,now());const cutoff=now()-5*60*1000;for(const [k,t] of seen)if(t<cutoff)seen.delete(k);while(seen.size>800)seen.delete(seen.keys().next().value);return false;}
  function profile(){return{deviceId,name:deviceName,role:currentRole,instrument:instrument(),transpose:transpose()};}
  function envelope(type,payload={}){return{type,payload,messageId:`${deviceId}:v141:${now().toString(36)}:${Math.random().toString(36).slice(2,9)}`,senderId:deviceId,senderRole:currentRole,roomId:room(),roomToken:token(),timestamp:now(),version:VERSION};}
  function saveSnapshot(state){try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({at:now(),state}))}catch(_e){}}
  function loadSnapshot(){try{const x=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||"null");return x&&now()-Number(x.at)<12*60*60*1000?x.state:null}catch(_e){return null}}

  function ensureChip(){let el=document.getElementById("lv141-net");if(el)return el;el=document.createElement("div");el.id="lv141-net";el.style.cssText="position:fixed;left:12px;top:12px;z-index:99998;padding:7px 10px;border-radius:999px;background:#2b1d0d;color:#ffd98a;border:1px solid #65491f;font:800 11px system-ui;pointer-events:none";el.textContent="V14.1 · conectando";document.body.appendChild(el);return el;}
  function setChip(text,kind="warn"){const el=ensureChip();el.textContent=`V14.1 · ${text}`;const p=kind==="ok"?["#123324","#9cf0c9","#235f47"]:kind==="bad"?["#3b171d","#ff9eaa","#73303b"]:["#2b1d0d","#ffd98a","#65491f"];el.style.background=p[0];el.style.color=p[1];el.style.borderColor=p[2];}

  const previousApply=typeof applyRemoteState==="function"?applyRemoteState:null;
  if(previousApply)applyRemoteState=function(state){if(state&&typeof state==="object")saveSnapshot(state);return previousApply(state);};

  const previousBroadcastState=typeof broadcastCurrentState==="function"?broadcastCurrentState:null;
  if(previousBroadcastState)broadcastCurrentState=function(force=false){try{if(typeof getCurrentState==="function")saveSnapshot(getCurrentState())}catch(_e){}return previousBroadcastState(force);};

  function rawSend(type,payload={}){if(!(ws&&ws.readyState===WebSocket.OPEN))return false;try{ws.send(JSON.stringify(envelope(type,payload)));return true}catch(_e){return false}}
  function clearRetry(){clearTimeout(retryTimer);retryTimer=null;}
  function scheduleRetry(reason="desconectado"){
    if(manualClose||!wsBase())return;
    clearRetry();
    const base=Math.min(30000,900*Math.pow(2,Math.min(retry++,5)));
    const delay=Math.round(base*(0.8+Math.random()*0.4));
    setChip(`${reason} · reconexión ${Math.ceil(delay/1000)}s`,"warn");
    retryTimer=setTimeout(()=>connectWebSocket({silent:true}),delay);
  }
  function startHeartbeat(){clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>{if(ws&&ws.readyState===WebSocket.OPEN)rawSend("PING",profile());},10000);}

  connectWebSocket=function(options={}){
    const t=now();
    if(options.silent&&ws&&(ws.readyState===WebSocket.OPEN||ws.readyState===WebSocket.CONNECTING)&&t-lastConnectAt<1400)return;
    lastConnectAt=t;
    const base=(document.getElementById("ws-url-input")?.value||wsBase()).trim();
    const roomToken=(document.getElementById("ws-room-token-input")?.value||token()).trim();
    if(!base){if(!options.silent)showToast?.("Introduce una dirección WebSocket","warning");return;}
    if(!/^wss?:\/\//i.test(base)){if(!options.silent)showToast?.("La URL debe comenzar con ws:// o wss://","warning");return;}
    localStorage.setItem(STORAGE_KEYS.wsUrl,base);localStorage.setItem(TOKEN_KEY,roomToken);manualClose=false;clearRetry();
    if(ws){try{ws.onclose=null;ws.close()}catch(_e){}ws=null;}
    try{
      const endpoint=new URL(base);endpoint.searchParams.set("room",room());endpoint.searchParams.set("token",roomToken);endpoint.searchParams.set("device",deviceId);endpoint.searchParams.set("role",currentRole);endpoint.searchParams.set("name",deviceName);endpoint.searchParams.set("instrument",instrument());endpoint.searchParams.set("transpose",String(transpose()));endpoint.searchParams.set("v",VERSION);
      const socket=new WebSocket(endpoint.toString());ws=socket;setChip("conectando","warn");updateNetworkUI?.("Conectando…");
      socket.onopen=()=>{if(ws!==socket)return;retry=0;lastMessageAt=now();networkMode="websocket";setChip("conectado","ok");updateNetworkUI?.();rawSend("DEVICE_JOIN",profile());rawSend("DEVICE_PROFILE",profile());if(currentRole==="operator")setTimeout(()=>broadcastCurrentState?.(true),120);else setTimeout(()=>rawSend("RESYNC_REQUEST",{deviceId}),180);if(!options.silent)showToast?.("📡 Stage Network conectado");};
      socket.onmessage=e=>{if(ws!==socket||typeof e.data!=="string"||e.data.length>65536)return;let msg;try{msg=JSON.parse(e.data)}catch(_e){return}lastMessageAt=now();if(msg.messageId&&remember(msg.messageId))return;try{handleNetworkMessage(msg,"websocket")}catch(err){console.error("LiveVoz V14.1 mensaje",err)}};
      socket.onerror=()=>{setChip("problema de red","warn");updateNetworkUI?.("Error de red")};
      socket.onclose=e=>{if(ws===socket)ws=null;if(networkMode==="websocket")networkMode="local";if(e.code===4001){setChip("PIN o sala rechazado","bad");updateNetworkUI?.("PIN/sala rechazado");showToast?.("PIN de Stage Network incorrecto","error");return}scheduleRetry(navigator.onLine===false?"sin Wi‑Fi":"desconectado")};
    }catch(_e){scheduleRetry("error de conexión")}
  };

  closeWebSocket=function(){manualClose=true;clearRetry();clearInterval(heartbeatTimer);if(ws){try{if(ws.readyState===WebSocket.OPEN)rawSend("DEVICE_LEAVE",{deviceId});ws.onclose=null;ws.close(1000,"client-close")}catch(_e){}ws=null;}retry=0;setChip("desconectado","bad");};

  function recoverView(){if(currentRole==="operator")return;const state=loadSnapshot();if(!state)return;try{applyRemoteState(state);setChip("último estado recuperado","warn")}catch(_e){}}
  function networkWatch(){window.addEventListener("online",()=>{setChip("red recuperada · reconectando","warn");if(!ws||ws.readyState!==WebSocket.OPEN){retry=0;lastConnectAt=0;connectWebSocket({silent:true})}});window.addEventListener("offline",()=>setChip("sin conexión · modo supervivencia","bad"));}
  function connectionWatch(){setInterval(()=>{if(navigator.onLine===false){setChip("sin conexión · modo supervivencia","bad");return}if(ws&&ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>128*1024)setChip("red congestionada","warn");else setChip("conectado","ok");return}if(ws&&ws.readyState===WebSocket.CONNECTING){setChip("conectando","warn");return}if(!manualClose&&wsBase())setChip("reconectando","warn")},3000);}

  function installRecoveryButton(){if(currentRole!=="operator")return;const actions=document.querySelector(".toolbar-actions");if(!actions||document.getElementById("lv141-resync"))return;const b=document.createElement("button");b.id="lv141-resync";b.className="small-btn";b.textContent="↻ Resincronizar";b.title="Envía el estado actual a todos los dispositivos";b.onclick=()=>{broadcastCurrentState?.(true);rawSend("SIGNAL",{label:"SINCRONIZADO",kind:"ok",ms:1200,vibrate:[80]});showToast?.("Estado reenviado a todos los dispositivos")};actions.appendChild(b);}

  function boot(){document.title="LiveVoz V14.1 Stage Director";const sub=document.querySelector(".brand-sub");if(sub)sub.textContent="V14.1 · STAGE DIRECTOR · CONCERT RELIABILITY";ensureChip();recoverView();networkWatch();connectionWatch();startHeartbeat();installRecoveryButton();if(!navigator.onLine)setChip("sin conexión · modo supervivencia","bad");else if(wsBase())setTimeout(()=>connectWebSocket({silent:true}),350);console.info("LiveVoz V14.1 reliability activo");}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else setTimeout(boot,0);
})();