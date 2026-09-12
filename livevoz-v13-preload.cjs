"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("livevozDesktop", {
  stageStatus: () => ipcRenderer.invoke("livevoz:stage-status"),
  startStage: () => ipcRenderer.invoke("livevoz:start-stage"),
  stopStage: () => ipcRenderer.invoke("livevoz:stop-stage"),
  preflight: () => ipcRenderer.invoke("livevoz:preflight"),
  createInvite: (payload) => ipcRenderer.invoke("livevoz:create-invite", payload || {}),
  setConcertMode: (enabled) => ipcRenderer.invoke("livevoz:concert-mode", Boolean(enabled))
});
