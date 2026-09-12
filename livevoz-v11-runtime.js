(() => {
  "use strict";
  const V11 = "11.1.0";
  const SUPABASE_URL = "https://yyjeihyldqbvkkpswxwg.supabase.co";
  const SUPABASE_KEY = "sb_publishable_cVxRnBOHGNmtg2WlXSWIqA_C9UhRd9g";
  const ROOM_TOKEN_KEY = "livevoz_ws_room_token";
  const MAX_MESSAGE_AGE = 5 * 60 * 1000;
  const HEARTBEAT_MS = 15000;
  const STALE_MS = 45000;
  let cloud = null, cloudUser = null, realtime = null;
  let reconnectAttempt = 0, reconnectTimer = null, heartbeatTimer = null, manualClose = false;
  let sequence = 0;
  const seen = new Map();

  function roomId(){ return String(currentConcertId || concertName || "livevoz-default").trim(); }
  function roomToken(){ return (localStorage.getItem(ROOM_TOKEN_KEY) || "").trim(); }
  function messageId(){ return `${deviceId}:${Date.now().toString(36)}:${(++sequence).toString(36)}:${Math.random().toString(36).slice(2,9)}`; }
  function remember(id,ts=Date.now()){
    if(!id) return false;
    if(seen.has(id)) return true;
    seen.set(id,ts);
    if(seen.size>600){
      const cutoff=Date.now()-MAX_MESSAGE_AGE;
      for(const [key,time] of seen) if(time<cutoff) seen.delete(key);
      while(seen.size>500) seen.delete(seen.keys().next().value);
    }
    return false;
  }
  function cleanPayload(type,p){
    if(type==="STATE"){
      if(!p||typeof p!=="object") return null;
      return {songId:typeof p.songId==="string"?p.songId:null,songIndex:Number.isInteger(p.songIndex)?p.songIndex:null,lineIndex:Number.isInteger(p.lineIndex)?p.lineIndex:0,bpm:Math.max(30,Math.min(250,Number(p.bpm)||100)),key:typeof p.key==="string"?p.key.slice(0,12):"C",transposeOffset:Math.max(-24,Math.min(24,Number(p.transposeOffset)||0)),concertId:typeof p.concertId==="string"?p.concertId:null,concertName:typeof p.concertName==="string"?p.concertName.slice(0,120):""};
    }
    if(type==="COMMAND"){
      if(!p||typeof p!=="object") return null;
      const allowed=new Set(["NEXT","PREV","REPEAT","CHORUS","LINE","SONG","ROLE","ALERT"]);
      if(!allowed.has(p.action)) return null;
      return {action:p.action,index:Number.isFinite(Number(p.index))?Number(p.index):undefined,songId:typeof p.songId==="string"?p.songId.slice(0,120):undefined,role:["operator","singer","musician","hybrid"].includes(p.role)?p.role:undefined,message:typeof p.message==="string"?p.message.slice(0,300):undefined};
    }
    if(["PING","PONG","DEVICE_JOIN","DEVICE_LEAVE"].includes(type)) return {deviceId:typeof p?.deviceId==="string"?p.deviceId.slice(0,120):undefined,name:typeof p?.name==="string"?p.name.slice(0,80):undefined,role:["operator","singer","musician","hybrid"].includes(p?.role)?p.role:undefined};
    return null;
  }

  broadcastMessage = function(message){
    const type=String(message?.type||"");
    const payload=cleanPayload(type,message?.payload);
    if(!payload && !["PING","PONG","DEVICE_JOIN","DEVICE_LEAVE"].includes(type)) return;
    const envelope={type,payload:payload||{},messageId:messageId(),senderId:deviceId,senderRole:currentRole,roomId:roomId(),roomToken:roomToken(),timestamp:Date.now(),sequence,version:V11};
    remember(envelope.messageId,envelope.timestamp);
    try{localChannel?.postMessage(envelope);}catch(_e){}
    if(ws && ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify(envelope));}catch(_e){}}
  };

  handleNetworkMessage = function(message,transport="unknown"){
    if(!message||typeof message!=="object"||message.senderId===deviceId) return;
    if(message.roomId && message.roomId!==roomId()) return;
    if(transport==="websocket" && roomToken() && message.roomToken!==roomToken()) return;
    if(typeof message.timestamp==="number" && Math.abs(Date.now()-message.timestamp)>MAX_MESSAGE_AGE) return;
    if(message.messageId && remember(message.messageId,message.timestamp||Date.now())) return;
    const type=String(message.type||"");
    const payload=cleanPayload(type,message.payload);
    if(type==="STATE"&&payload) applyRemoteState(payload);
    else if(type==="COMMAND"&&payload){if(message.senderRole==="operator") executeRemoteCommand(payload);}
    else if(type==="PING"){registerDevice({...payload,online:true,lastSeen:Date.now()});broadcastMessage({type:"PONG",payload:{deviceId,name:deviceName,role:currentRole}});}
    else if(type==="PONG") registerDevice({...payload,online:true,lastSeen:Date.now()});
    else if(type==="DEVICE_JOIN"){registerDevice({...payload,online:true,lastSeen:Date.now()});if(currentRole==="operator")broadcastMessage({type:"STATE",payload:getCurrentState()});}
    else if(type==="DEVICE_LEAVE") removeDevice(payload?.deviceId);
  };

  function rebuildLocalChannel(){
    try{localChannel?.close?.();}catch(_e){}
    try{
      localChannel=new BroadcastChannel("concert-stage-network-v11");
      localChannel.onmessage=e=>handleNetworkMessage(e.data,"broadcast");
    }catch(_e){}
  }

  connectWebSocket = function(options={}){
    const url=(document.getElementById("ws-url-input")?.value||localStorage.getItem(STORAGE_KEYS.wsUrl)||"").trim();
    const token=(document.getElementById("ws-room-token-input")?.value||roomToken()).trim();
    if(!url){if(!options.silent)showToast("Introduce una dirección WebSocket","warning");return;}
    if(!/^wss?:\/\//i.test(url)){if(!options.silent)showToast("La URL debe comenzar con ws:// o wss://","warning");return;}
    localStorage.setItem(STORAGE_KEYS.wsUrl,url);localStorage.setItem(ROOM_TOKEN_KEY,token);manualClose=false;
    if(ws){try{ws.onclose=null;ws.close();}catch(_e){}ws=null;}
    try{
      const endpoint=new URL(url);endpoint.searchParams.set("room",roomId());endpoint.searchParams.set("token",token);endpoint.searchParams.set("device",deviceId);endpoint.searchParams.set("role",currentRole);endpoint.searchParams.set("v",V11);
      const socket=new WebSocket(endpoint.toString());ws=socket;updateNetworkUI("Conectando…");
      socket.onopen=()=>{if(ws!==socket)return;reconnectAttempt=0;networkMode="websocket";updateNetworkUI();if(!options.silent)showToast("📡 Stage Network conectado");broadcastMessage({type:"DEVICE_JOIN",payload:{deviceId,name:deviceName,role:currentRole}});if(currentRole==="operator")broadcastCurrentState(true);};
      socket.onmessage=e=>{if(typeof e.data!=="string"||e.data.length>65536)return;try{handleNetworkMessage(JSON.parse(e.data),"websocket");}catch(_e){}};
      socket.onerror=()=>updateNetworkUI("Error de red");
      socket.onclose=e=>{if(ws===socket)ws=null;if(networkMode==="websocket")networkMode="local";updateNetworkUI(e.code===4001?"PIN/sala rechazado":"Desconectado");if(e.code===4001)showToast("PIN de Stage Network incorrecto","error");else if(!manualClose)scheduleReconnect();};
    }catch(_e){updateNetworkUI("Error");scheduleReconnect();}
  };
  scheduleReconnect = function(){
    clearTimeout(reconnectTimer);if(manualClose||!localStorage.getItem(STORAGE_KEYS.wsUrl))return;
    const base=Math.min(30000,1000*Math.pow(2,Math.min(reconnectAttempt++,5)));const delay=Math.round(base*(0.8+Math.random()*0.4));updateNetworkUI(`Reconectando en ${Math.ceil(delay/1000)}s…`);
    reconnectTimer=setTimeout(()=>connectWebSocket({silent:true}),delay);
  };
  closeWebSocket = function(){manualClose=true;clearTimeout(reconnectTimer);if(ws){try{if(ws.readyState===WebSocket.OPEN)broadcastMessage({type:"DEVICE_LEAVE",payload:{deviceId}});ws.onclose=null;ws.close(1000,"client-close");}catch(_e){}ws=null;}reconnectAttempt=0;};
  activateLocalMode = function(){closeWebSocket();networkMode="local";updateNetworkUI();showToast("🏠 Modo local activado");};

  function addNetworkPin(){
    const input=document.getElementById("ws-url-input");if(!input||document.getElementById("ws-room-token-input"))return;
    const group=document.createElement("div");group.className="form-group";group.style.marginTop="8px";group.innerHTML='<label>PIN / token de la sala</label><input id="ws-room-token-input" maxlength="64" placeholder="Ej. SERENATA-2026">';input.closest(".form-group")?.after(group);
    group.querySelector("input").value=roomToken();
  }
  const oldOpenNetworkModal=openNetworkModal;
  openNetworkModal=function(){oldOpenNetworkModal();addNetworkPin();setValue("ws-room-token-input",roomToken());};

  async function initCloud(){
    if(!window.supabase?.createClient){setCloudStatus("Supabase SDK no disponible",false);return;}
    try{
      cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true},realtime:{params:{eventsPerSecond:10}}});
      const {data}=await cloud.auth.getSession();cloudUser=data?.session?.user||null;renderAuth();
      cloud.auth.onAuthStateChange((_event,session)=>{cloudUser=session?.user||null;renderAuth();if(cloudUser)subscribeRealtime();else unsubscribeRealtime();});
      if(cloudUser)subscribeRealtime();
    }catch(error){console.error("LiveVoz Supabase",error);setCloudStatus("Error Supabase",false);}
  }
  function setCloudStatus(text,online=!!cloudUser){const el=document.getElementById("livevoz-cloud-status");if(el){el.textContent=text;el.style.color=online?"#2ecc71":"#888";}}
  function renderAuth(){setCloudStatus(cloudUser?`☁ ${cloudUser.email||"conectado"}`:"☁ Nube desconectada",!!cloudUser);document.getElementById("lv-auth-out")?.classList.toggle("hidden",!!cloudUser);document.getElementById("lv-auth-in")?.classList.toggle("hidden",!cloudUser);if(cloudUser)setText("lv-user-email",cloudUser.email||cloudUser.id);}

  window.lvSignUp=async()=>{const email=document.getElementById("lv-email").value.trim(),password=document.getElementById("lv-password").value;if(password.length<6)return showToast("Contraseña mínima: 6 caracteres","warning");const {error}=await cloud.auth.signUp({email,password});if(error)return showToast(error.message,"error");showToast("Cuenta creada. Revisa tu correo si Supabase solicita confirmación.","info");};
  window.lvSignIn=async()=>{const email=document.getElementById("lv-email").value.trim(),password=document.getElementById("lv-password").value;const {data,error}=await cloud.auth.signInWithPassword({email,password});if(error)return showToast(error.message,"error");cloudUser=data.user;renderAuth();await lvPullCloud();showToast("☁ Sesión iniciada");};
  window.lvSignOut=async()=>{await cloud?.auth.signOut();cloudUser=null;renderAuth();unsubscribeRealtime();};
  window.lvBackup=async()=>{if(!cloudUser)return showToast("Inicia sesión","warning");const payload={version:V11,createdAt:new Date().toISOString(),playlist,concerts,currentConcertId};const {error}=await cloud.from("backups").insert({user_id:cloudUser.id,name:`LiveVoz ${new Date().toLocaleString()}`,payload});if(error)return showToast(error.message,"error");await history("backup_created","backup","latest",{songs:playlist.length});showToast("☁ Respaldo creado");};
  window.lvRestore=async()=>{if(!cloudUser)return showToast("Inicia sesión","warning");const {data,error}=await cloud.from("backups").select("payload").eq("user_id",cloudUser.id).order("created_at",{ascending:false}).limit(1).maybeSingle();if(error||!data)return showToast("No hay respaldo disponible","warning");if(!confirm("¿Restaurar el último respaldo?"))return;const p=data.payload||{};if(Array.isArray(p.playlist))playlist=p.playlist.map((s,i)=>normalizeSong(s,i));if(Array.isArray(p.concerts))concerts=migrateConcerts(p.concerts);if(p.currentConcertId)currentConcertId=p.currentConcertId;saveLibrary();saveConcerts();ensureCurrentSongVisible();renderConcerts();updateViews();showToast("↺ Respaldo restaurado");};
  window.lvSyncCloud=async()=>{if(!cloudUser)return showToast("Inicia sesión","warning");const now=new Date().toISOString();const rows=playlist.map(song=>({id:song.id,user_id:cloudUser.id,title:song.title,category:song.category,bpm:song.bpm,key:song.key,lyrics:song.lyrics,chords:song.chords,cues:song.cues,transpose_offset:Number(song.transposeOffset)||0,updated_at:now}));let {error}=await cloud.from("songs").upsert(rows,{onConflict:"id"});if(error)return showToast(error.message,"error");for(const c of concerts){({error}=await cloud.from("concerts").upsert({id:c.id,owner_id:cloudUser.id,name:c.name,updated_at:now},{onConflict:"id"}));if(error)continue;await cloud.from("concert_songs").delete().eq("concert_id",c.id);if(c.songIds?.length)await cloud.from("concert_songs").insert(c.songIds.map((song_id,position)=>({concert_id:c.id,song_id,position})));}await history("library_synced","library","all",{songs:rows.length,concerts:concerts.length});showToast("⇅ Biblioteca sincronizada");};
  window.lvPullCloud=async()=>{if(!cloudUser)return;const {data:songs}=await cloud.from("songs").select("*").order("updated_at",{ascending:true});if(songs?.length){const map=new Map(playlist.map(s=>[s.id,s]));songs.forEach(r=>map.set(r.id,normalizeSong({id:r.id,title:r.title,category:r.category,bpm:r.bpm,key:r.key,lyrics:r.lyrics,chords:r.chords,cues:r.cues,transposeOffset:r.transpose_offset})));playlist=[...map.values()];saveLibrary();}const {data:cc}=await cloud.from("concerts").select("id,name,concert_songs(song_id,position)");if(cc?.length){const map=new Map(concerts.map(c=>[c.id,c]));cc.forEach(c=>map.set(c.id,{id:c.id,name:c.name,songIds:(c.concert_songs||[]).sort((a,b)=>a.position-b.position).map(x=>x.song_id)}));concerts=migrateConcerts([...map.values()]);saveConcerts();}ensureCurrentSongVisible();renderConcerts();updateViews({broadcast:false});};
  window.lvShareConcert=async()=>{if(!cloudUser)return showToast("Inicia sesión","warning");await lvSyncCloud();const email=document.getElementById("lv-share-email").value.trim().toLowerCase();const {error}=await cloud.rpc("share_concert_by_email",{p_concert_id:currentConcertId,p_email:email,p_role:"musician"});if(error)return showToast(error.message,"error");await history("concert_shared","concert",currentConcertId,{email});showToast(`🤝 Concierto compartido con ${email}`);};
  async function history(action,entity_type,entity_id,details={}){if(cloudUser)await cloud.from("change_history").insert({user_id:cloudUser.id,action,entity_type,entity_id:String(entity_id||""),details});}
  window.lvHistory=async()=>{openModal("livevoz-cloud-modal");const box=document.getElementById("lv-history");if(!cloudUser)return box.innerHTML='<div class="empty-state">Inicia sesión para ver el historial.</div>';const {data,error}=await cloud.from("change_history").select("action,entity_type,created_at").order("created_at",{ascending:false}).limit(100);box.innerHTML=error?'<div class="empty-state">Error al cargar historial.</div>':(data||[]).map(x=>`<div style="padding:8px;border-bottom:1px solid #292929"><strong>${escapeHtml(x.action.replaceAll("_"," "))}</strong><small style="display:block;color:#777">${escapeHtml(x.entity_type)} · ${new Date(x.created_at).toLocaleString()}</small></div>`).join("")||'<div class="empty-state">Sin cambios todavía.</div>';};
  function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}

  function subscribeRealtime(){if(!cloud||!cloudUser||!currentConcertId)return;unsubscribeRealtime();realtime=cloud.channel(`livevoz:${currentConcertId}`).on("postgres_changes",{event:"*",schema:"public",table:"live_sessions",filter:`concert_id=eq.${currentConcertId}`},payload=>{const row=payload.new;if(row?.state&&row.host_user_id!==cloudUser.id)applyRemoteState(row.state);}).subscribe();}
  function unsubscribeRealtime(){if(cloud&&realtime)cloud.removeChannel(realtime).catch(()=>{});realtime=null;}
  async function publishCloudState(){if(!cloudUser||currentRole!=="operator"||!currentConcertId)return;await cloud.from("live_sessions").upsert({concert_id:currentConcertId,host_user_id:cloudUser.id,state:getCurrentState(),updated_at:new Date().toISOString()},{onConflict:"concert_id"});}
  const originalBroadcastCurrentState=broadcastCurrentState;
  broadcastCurrentState=function(force=false){originalBroadcastCurrentState(force);publishCloudState().catch(()=>{});};
  const originalActivateConcert=activateConcert;
  activateConcert=function(id){originalActivateConcert(id);subscribeRealtime();};

  function injectCloudUI(){
    if(document.getElementById("livevoz-cloud-modal"))return;
    const actions=document.querySelector(".toolbar-actions");
    if(actions){const status=document.createElement("span");status.id="livevoz-cloud-status";status.style.cssText="align-self:center;font-size:.65rem;color:#888;padding:0 4px";status.textContent="☁ Nube desconectada";actions.prepend(status);const btn=document.createElement("button");btn.className="small-btn";btn.textContent="☁ Nube";btn.onclick=()=>openModal("livevoz-cloud-modal");actions.appendChild(btn);}
    const modal=document.createElement("div");modal.id="livevoz-cloud-modal";modal.className="modal-overlay";modal.setAttribute("aria-hidden","true");modal.innerHTML=`<div class="modal"><div class="modal-header"><h2>☁ LiveVoz Cloud V11.1</h2><button class="close-btn" onclick="closeModal('livevoz-cloud-modal')">×</button></div><div id="lv-auth-out"><div class="modal-grid"><div class="form-group"><label>Correo</label><input id="lv-email" type="email" autocomplete="email"></div><div class="form-group"><label>Contraseña</label><input id="lv-password" type="password" autocomplete="current-password"></div></div><div class="modal-actions"><button class="stage-btn primary" onclick="lvSignIn()">Iniciar sesión</button><button class="stage-btn" onclick="lvSignUp()">Crear cuenta</button></div></div><div id="lv-auth-in" class="hidden"><div class="network-status-card"><strong id="lv-user-email"></strong><button class="small-btn" onclick="lvSignOut()">Cerrar sesión</button></div></div><div class="modal-section"><div class="modal-actions"><button class="small-btn" onclick="lvSyncCloud()">⇅ Sincronizar</button><button class="small-btn" onclick="lvBackup()">☁ Respaldo</button><button class="small-btn" onclick="lvRestore()">↺ Restaurar</button></div></div><div class="modal-section"><div class="form-group"><label>Compartir concierto con músico</label><input id="lv-share-email" type="email" placeholder="musico@correo.com"></div><div class="modal-actions"><button class="small-btn active" onclick="lvShareConcert()">Compartir</button><button class="small-btn" onclick="lvHistory()">🕘 Historial</button></div><div id="lv-history" style="max-height:230px;overflow:auto;margin-top:10px"></div></div></div>`;
    document.body.appendChild(modal);
  }

  function startHeartbeat(){clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>{broadcastMessage({type:"PING",payload:{deviceId,name:deviceName,role:currentRole}});const now=Date.now();connectedDevices.forEach(d=>{if(d.deviceId!==deviceId&&now-(d.lastSeen||0)>STALE_MS)d.online=false;});renderDevices();},HEARTBEAT_MS);}

  function boot(){
    try{document.title="LiveVoz Teleprompter V11.1";document.querySelector(".brand-sub") && (document.querySelector(".brand-sub").textContent="V11.1 · SUPABASE CLOUD · STAGE NETWORK");addNetworkPin();rebuildLocalChannel();injectCloudUI();startHeartbeat();initCloud();const saved=localStorage.getItem(STORAGE_KEYS.wsUrl);if(saved)setTimeout(()=>connectWebSocket({silent:true}),1000);console.info("LiveVoz V11.1 runtime activo");}catch(error){console.error("LiveVoz V11.1 boot",error);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
