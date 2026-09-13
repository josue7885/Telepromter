(()=>{
  "use strict";
  const SUPABASE_URL="https://yyjeihyldqbvkkpswxwg.supabase.co";
  const SUPABASE_KEY="sb_publishable_cVxRnBOHGNmtg2WlXSWIqA_C9UhRd9g";
  const AUTH_KEY="sb-yyjeihyldqbvkkpswxwg-auth-token";
  const PARTS_KEY="livevoz_v14_parts";
  const HISTORY_KEY="livevoz_v14_history";

  function session(){
    try{
      const raw=localStorage.getItem(AUTH_KEY);if(!raw)return null;
      const data=JSON.parse(raw);return data?.access_token?data:data?.currentSession||data?.session||null;
    }catch(_e){return null}
  }
  async function rest(path,{method="GET",body=null,prefer=""}={}){
    const s=session();if(!s?.access_token)throw new Error("Inicia sesión en LiveVoz Cloud");
    const headers={apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`,"Content-Type":"application/json"};
    if(prefer)headers.Prefer=prefer;
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers,body:body==null?undefined:JSON.stringify(body)});
    if(!r.ok){let msg=`HTTP ${r.status}`;try{const j=await r.json();msg=j.message||j.error||msg}catch(_e){}throw new Error(msg)}
    if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null;
  }
  function toast(text,type="info"){try{showToast?.(text,type)}catch(_e){console.log(text)}}
  async function share(){
    const email=document.getElementById("lv14-share-email")?.value.trim().toLowerCase();
    const role=document.getElementById("lv14-share-role")?.value||"musician";
    if(!email)return toast("Escribe un correo","warning");
    try{await rest("rpc/share_concert_by_email",{method:"POST",body:{p_concert_id:currentConcertId,p_email:email,p_role:role}});toast(`🤝 Compartido como ${role}`);}
    catch(e){toast(e.message,"error")}
  }
  async function syncParts(){
    let parts={};try{parts=JSON.parse(localStorage.getItem(PARTS_KEY)||"{}")||{}}catch(_e){}
    const rows=[];for(const [song_id,inst] of Object.entries(parts))for(const [instrument,note] of Object.entries(inst||{}))if(String(note||"").trim())rows.push({song_id,instrument,note:String(note).trim(),updated_at:new Date().toISOString()});
    if(!rows.length)return toast("No hay partes V14 para sincronizar","warning");
    try{await rest("song_instrument_parts?on_conflict=song_id,instrument",{method:"POST",body:rows,prefer:"resolution=merge-duplicates,return=minimal"});toast(`☁ ${rows.length} partes sincronizadas`)}catch(e){toast(e.message,"error")}
  }
  function exportReport(){
    let history=[];try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]")||[]}catch(_e){}
    const songIds=(concerts?.find?.(c=>c.id===currentConcertId)?.songIds)||[];
    const songs=songIds.map(id=>playlist.find(s=>s.id===id)).filter(Boolean).map(s=>({id:s.id,title:s.title,key:s.key,bpm:s.bpm,category:s.category}));
    const report={app:"LiveVoz V14 Stage Director",generatedAt:new Date().toISOString(),concert:{id:currentConcertId,name:concertName},songs,history};
    const blob=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`livevoz-${String(concertName||"evento").replace(/[^a-z0-9_-]+/gi,"-")}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast("📊 Reporte del evento exportado");
  }
  function section(){
    const wrap=document.createElement("div");wrap.id="lv14-cloud-section";wrap.className="modal-section";wrap.innerHTML=`<b>☁ Equipo y reporte V14</b><div class="modal-grid" style="margin-top:8px"><div class="form-group"><label>Correo del integrante</label><input id="lv14-share-email" type="email" placeholder="musico@correo.com"></div><div class="form-group"><label>Rol</label><select id="lv14-share-role"><option value="admin">Administrador</option><option value="operator">Operador</option><option value="musician" selected>Músico</option><option value="singer">Cantante</option></select></div></div><div class="modal-actions"><button class="small-btn active" id="lv14-share-btn">Compartir concierto</button><button class="small-btn" id="lv14-sync-parts">☁ Sincronizar partes</button><button class="small-btn" id="lv14-export-report">📊 Exportar reporte</button></div>`;
    wrap.querySelector("#lv14-share-btn").addEventListener("click",share);wrap.querySelector("#lv14-sync-parts").addEventListener("click",syncParts);wrap.querySelector("#lv14-export-report").addEventListener("click",exportReport);return wrap;
  }
  function inject(){const modal=document.querySelector("#lv14-director .modal");if(modal&&!modal.querySelector("#lv14-cloud-section"))modal.appendChild(section())}
  const observer=new MutationObserver(inject);observer.observe(document.documentElement,{subtree:true,childList:true});setInterval(inject,1200);
  console.info("LiveVoz V14 Cloud tools activos");
})();