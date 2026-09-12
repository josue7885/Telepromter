(() => {
  "use strict";

  function currentRoom(){
    try {
      const id = typeof currentConcertId !== "undefined" ? currentConcertId : "";
      const name = typeof concertName !== "undefined" ? concertName : "";
      return String(id || name || "livevoz-default").trim();
    } catch (_e) {
      return "livevoz-default";
    }
  }

  function currentWsUrl(){
    try {
      if (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS.wsUrl) {
        return String(localStorage.getItem(STORAGE_KEYS.wsUrl) || "").trim();
      }
    } catch (_e) {}
    return "";
  }

  function currentToken(){
    return String(localStorage.getItem("livevoz_ws_room_token") || "").trim();
  }

  function reply(type, payload){
    try { window.top.postMessage({ type, ...payload }, "*"); } catch (_e) {}
  }

  window.addEventListener("message", (event) => {
    const message = event.data || {};
    if (message.type === "LIVEVOZ_V13_GET_STAGE_CONTEXT") {
      reply("LIVEVOZ_V13_STAGE_CONTEXT", {
        room: currentRoom(),
        token: currentToken(),
        wsUrl: currentWsUrl()
      });
      return;
    }

    if (message.type !== "LIVEVOZ_V13_SET_STAGE_CONFIG") return;

    const token = String(message.token || "").trim().slice(0, 64);
    const wsUrl = String(message.wsUrl || "").trim();

    try {
      if (typeof closeWebSocket === "function") closeWebSocket();
      localStorage.setItem("livevoz_ws_room_token", token);
      if (typeof STORAGE_KEYS !== "undefined" && STORAGE_KEYS.wsUrl && wsUrl) {
        localStorage.setItem(STORAGE_KEYS.wsUrl, wsUrl);
      }
      const urlInput = document.getElementById("ws-url-input");
      const tokenInput = document.getElementById("ws-room-token-input");
      if (urlInput && wsUrl) urlInput.value = wsUrl;
      if (tokenInput) tokenInput.value = token;
      setTimeout(() => {
        try {
          if (typeof connectWebSocket === "function" && wsUrl) connectWebSocket({ silent: true });
        } catch (_e) {}
      }, 250);
      reply("LIVEVOZ_V13_STAGE_CONFIGURED", { room: currentRoom(), token, wsUrl });
    } catch (error) {
      reply("LIVEVOZ_V13_STAGE_CONFIG_ERROR", { message: String(error?.message || error) });
    }
  });
})();
