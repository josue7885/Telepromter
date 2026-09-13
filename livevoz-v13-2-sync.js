(()=>{
  "use strict";
  const VERSION="13.2";
  const SESSION_ROOM_KEY="livevoz_stage_session_room";
  const TOKEN_KEY="livevoz_ws_room_token";
  const q=new URLSearchParams(location.search);
  const queryRoom=(q.get("stageRoom")||q.get("room")||"").trim();
  const queryToken=(q.get("token")||"").trim();
  const queryRole=(q.get("role")||"").trim();
  const queryName=(q.get("name")||"").trim();
  const queryInstrument=(q.get("instrument")||"").trim();
  const queryTranspose=Math.max(-12,Math.min(12,Math.round(Number(q.get("transpose"))||0)));

  if(queryRoom)localStorage.setItem(SESSION_ROOM_KEY,queryRoom);
  if(queryToken)localStorage.setItem(TOKEN_KEY,queryToken);
  if(queryName){try{deviceName=queryName;localStorage.setItem(STORAGE_KEYS.deviceName,queryName);}catch(_e){}}
  if(queryInstrument)localStorage.setItem("livevoz_mobile_instrument",queryInstrument);
  if(q.has("transpose"))localStorage.setItem("livevoz_mobile_transpose",String(queryTranspose));

  const stageRoom=()=>String(localStorage.getItem(SESSION_ROOM_KEY)||currentConcertId||concertName||"livevoz-default").trim();
  const stageToken=()=>String(localStorage.getItem(TOKEN_KEY)||"").trim();
  const personalTranspose=()=>Math.max(-12,Math.min(12,Math.round(Number(localStorage.getItem("livevoz_mobile_transpose"))||0)));
  const msgId=()=>`${deviceId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,9)}`;
  const safe=(v,n=200)=>typeof v==="string"?v.slice(0,n):"";

  const originalGetCurrentState=getCurrentState;
  getCurrentState=function(){
    const base=originalGetCurrentState();
    const song=playlist[currentSongIndex];
    const concert=concerts.find(c=>c.id===currentConcertId);
    return {...base,
      songTitle:safe(song?.title,160),
      lineText:safe(song?.lyrics?.[currentLineIndex],1200),
      previousLine:safe(song?.lyrics?.[currentLineIndex-1],1200),
      nextLine:safe(song?.lyrics?.[currentLineIndex+1],1200),
      lineChords:safe(song?.chords?.[currentLineIndex],600),
      cue:safe(song?.cues?.[currentLineIndex],160),
      concertSongIds:Array.isArray(concert?.songIds)?concert.songIds.slice(0,300):[]
    };
  };

  const originalApplyRemoteState=applyRemoteState;
  applyRemoteState=function(state){
    if(!state||typeof state!=="object")return;
    if(state.concertId&&!concerts.some(c=>c.id===state.concertId)){
      concerts.push({id:state.concertId,name:safe(state.concertName,120)||"Concierto remoto",songIds:Array.isArray(state.concertSongIds)?state.concertSongIds.filter(Boolean).slice(0,300):[]});
      try{saveConcerts();renderConcerts();}catch(_e){}
    }
    if(state.songId&&!playlist.some(s=>s.id===state.songId)){
      const count=Math.max(1,(Number.isInteger(state.lineIndex)?state.lineIndex:0)+2);
      const lyrics=Array(count).fill("…"),chords=Array(count).fill(""),cues=Array(count).fill("GENERAL");
      const i=Number.isInteger(state.lineIndex)?state.lineIndex:0;
      lyrics[i]=safe(state.lineText,1200)||"…";
      if(i>0&&state.previousLine)lyrics[i-1]=safe(state.previousLine,1200);
      if(state.nextLine)lyrics[i+1]=safe(state.nextLine,1200);
      chords[i]=safe(state.lineChords,600);cues[i]=safe(state.cue,160)||"GENERAL";
      playlist.push({id:state.songId,title:safe(state.songTitle,160)||"Canción remota",category:"Stage Network",bpm:Number(state.bpm)||100,key:safe(state.key,12)||"C",lyrics,chords,cues,transposeOffset:0,__livevozRemote:true});
      try{saveLibrary();}catch(_e){}
    }else if(state.songId){
      const song=playlist.find(s=>s.id===state.songId);
      if(song){
        const i=Number.isInteger(state.lineIndex)?state.lineIndex:0;
        while(song.lyrics.length<=i+1)song.lyrics.push("…");while(song.chords.length<=i+1)song.chords.push("");while(song.cues.length<=i+1)song.cues.push("GENERAL");
        if(state.songTitle)song.title=safe(state.songTitle,160);if(state.lineText)song.lyrics[i]=safe(state.lineText,1200);if(i>0&&state.previousLine)song.lyrics[i-1]=safe(state.previousLine,1200);if(state.nextLine)song.lyrics[i+1]=safe(state.nextLine,1200);if(state.lineChords!==undefined)song.chords[i]=safe(state.lineChords,600);if(state.cue)song.cues[i]=safe(state.cue,160);if(state.bpm)song.bpm=Number(state.bpm)||song.bpm;if(state.key)song.key=safe(state.key,12);
      }
    }
    originalApplyRemoteState(state);
    if(currentRole!=="operator"){
      const song=playlist[currentSongIndex];
      if(song){song.transposeOffset=(Number(state.transposeOffset)||0)+personalTranspose();try{updateViews({broadcast:false});}catch(_e){}}
    }
  };

  broadcastMessage=function(message){
    const type=String(message?.type||"");
    if(!["STATE","COMMAND","PING","PONG","DEVICE_JOIN","DEVICE_LEAVE","DEVICE_PROFILE"].includes(type))return;
    const envelope={type,payload:message?.payload||{},messageId:msgId(),senderId:deviceId,senderRole:currentRole,roomId:stageRoom(),roomToken:stageToken(),timestamp:Date.now(),version:VERSION};
    try{localChannel?.postMessage(envelope);}catch(_e){}
    if(ws&&ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify(envelope));}catch(_e){}}
  };

  handleNetworkMessage=function(message,transport="unknown"){
    if(!message||typeof message!=="object"||message.senderId===deviceId)return;
    if(message.roomId&&message.roomId!==stageRoom())return;
    if(typeof message.timestamp==="number"&&Math.abs(Date.now()-message.timestamp)>5*60*1000)return;
    const type=String(message.type||""),p=message.payload||{};
    if(type==="STATE")applyRemoteState(p);
    else if(type==="COMMAND"&&message.senderRole==="operator")executeRemoteCommand(p);
    else if(type==="PING"){registerDevice({...p,online:true,lastSeen:Date.now()});broadcastMessage({type:"PONG",payload:{deviceId,name:deviceName,role:currentRole,instrument:queryInstrument,transpose:personalTranspose()}});}
    else if(type==="PONG"||type==="DEVICE_JOIN"||type==="DEVICE_PROFILE")registerDevice({...p,online:true,lastSeen:Date.now()});
    else if(type==="DEVICE_LEAVE")removeDevice(p?.deviceId);
    if(type==="DEVICE_JOIN"&&currentRole==="operator")broadcastMessage({type:"STATE",payload:getCurrentState()});
  };

  connectWebSocket=function(options={}){
    const url=(document.getElementById("ws-url-input")?.value||localStorage.getItem(STORAGE_KEYS.wsUrl)||"").trim();
    const token=(document.getElementById("ws-room-token-input")?.value||stageToken()).trim();
    if(!url){if(!options.silent)showToast("Introduce una dirección WebSocket","warning");return;}
    if(!/^wss?:\/\//i.test(url)){if(!options.silent)showToast("La URL debe comenzar con ws:// o wss://","warning");return;}
    localStorage.setItem(STORAGE_KEYS.wsUrl,url);localStorage.setItem(TOKEN_KEY,token);
    if(ws){try{ws.onclose=null;ws.close();}catch(_e){}ws=null;}
    try{
      const endpoint=new URL(url);endpoint.searchParams.set("room",stageRoom());endpoint.searchParams.set("token",token);endpoint.searchParams.set("device",deviceId);endpoint.searchParams.set("role",currentRole);endpoint.searchParams.set("name",deviceName);endpoint.searchParams.set("instrument",queryInstrument||localStorage.getItem("livevoz_mobile_instrument")||"");endpoint.searchParams.set("transpose",String(personalTranspose()));endpoint.searchParams.set("v",VERSION);
      const socket=new WebSocket(endpoint.toString());ws=socket;updateNetworkUI("Conectando…");
      socket.onopen=()=>{if(ws!==socket)return;networkMode="websocket";updateNetworkUI();if(!options.silent)showToast("📡 Stage Network conectado");broadcastMessage({type:"DEVICE_JOIN",payload:{deviceId,name:deviceName,role:currentRole,instrument:queryInstrument||localStorage.getItem("livevoz_mobile_instrument")||"",transpose:personalTranspose()}});if(currentRole==="operator")broadcastCurrentState(true);};
      socket.onmessage=e=>{if(typeof e.data!=="string"||e.data.length>65536)return;try{handleNetworkMessage(JSON.parse(e.data),"websocket");}catch(_e){}};
      socket.onerror=()=>updateNetworkUI("Error de red");
      socket.onclose=e=>{if(ws===socket)ws=null;if(networkMode==="websocket")networkMode="local";updateNetworkUI(e.code===4001?"PIN/sala rechazado":"Desconectado");if(e.code===4001)showToast("PIN de Stage Network incorrecto","error");else setTimeout(()=>connectWebSocket({silent:true}),1500);};
    }catch(_e){updateNetworkUI("Error");}
  };

  function boot132(){
    try{
      document.title="LiveVoz V13.2";
      const sub=document.querySelector(".brand-sub");if(sub)sub.textContent="V13.2 · FULL DEVICE SYNC";
      if(queryRole&&["singer","musician","hybrid","operator"].includes(queryRole))switchRole(queryRole,false);
      const localHost=location.hostname&&location.port?`${location.protocol==="https:"?"wss":"ws"}://${location.hostname}:${location.port}`:"";
      if(localHost&&queryRoom)localStorage.setItem(STORAGE_KEYS.wsUrl,localHost);
      if(queryRoom){setTimeout(()=>connectWebSocket({silent:true}),500);}
      else if(localStorage.getItem(SESSION_ROOM_KEY)&&localStorage.getItem(STORAGE_KEYS.wsUrl)){setTimeout(()=>connectWebSocket({silent:true}),500);}
      window.addEventListener("storage",e=>{if(e.key==="livevoz_mobile_transpose"&&currentRole!=="operator"&&typeof updateViews==="function")updateViews({broadcast:false});});
      console.info("LiveVoz V13.2 sync activo",stageRoom());
    }catch(error){console.error("LiveVoz V13.2",error);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot132,{once:true});else setTimeout(boot132,0);
})();
