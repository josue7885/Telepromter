const { app, BrowserWindow, Menu, shell, session, ipcMain } = require("electron");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { fork } = require("node:child_process");
const QRCode = require("qrcode");

const isDevelopment = !app.isPackaged;
const STAGE_PORT = Number(process.env.LIVEVOZ_WS_PORT || 8080);
let mainWindow = null;
let stageProcess = null;

function isAllowedExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch (_e) {
    return false;
  }
}

function localIpv4() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const item of list || []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

function requestJson(route) {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: STAGE_PORT, path: route, timeout: 1200 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (_e) { resolve(null); }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

async function stageStatus() {
  const [health, metrics] = await Promise.all([requestJson("/health"), requestJson("/metrics")]);
  return {
    running: Boolean(health && health.ok),
    managedByApp: Boolean(stageProcess),
    ip: localIpv4(),
    port: STAGE_PORT,
    health: health || {},
    rooms: metrics?.activeRooms || []
  };
}

async function startStage() {
  const current = await stageStatus();
  if (current.running) return current;
  const serverPath = path.join(__dirname, "stage-server.cjs");
  stageProcess = fork(serverPath, [], {
    cwd: __dirname,
    env: { ...process.env, LIVEVOZ_WS_PORT: String(STAGE_PORT) },
    stdio: isDevelopment ? "inherit" : "ignore"
  });
  stageProcess.once("exit", () => { stageProcess = null; });
  await new Promise((resolve) => setTimeout(resolve, 350));
  return stageStatus();
}

async function stopStage() {
  if (stageProcess) {
    try { stageProcess.kill("SIGTERM"); } catch (_e) {}
    stageProcess = null;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return stageStatus();
}

function registerIpc() {
  ipcMain.handle("livevoz:stage-status", () => stageStatus());
  ipcMain.handle("livevoz:start-stage", () => startStage());
  ipcMain.handle("livevoz:stop-stage", () => stopStage());
  ipcMain.handle("livevoz:preflight", async () => {
    const started = Date.now();
    const status = await stageStatus();
    return {
      checks: [
        { name: "Stage Network", ok: status.running },
        { name: "Dirección IPv4 local", ok: Boolean(status.ip && status.ip !== "127.0.0.1") },
        { name: "Puerto 8080 / configurado", ok: Boolean(status.port) },
        { name: "Servidor responde", ok: Boolean(status.health?.ok) },
        { name: "Tiempo de respuesta < 1.5 s", ok: Date.now() - started < 1500 }
      ]
    };
  });
  ipcMain.handle("livevoz:create-invite", async (_event, payload) => {
    const status = await stageStatus();
    if (!status.running) await startStage();
    const room = String(payload?.room || "livevoz-stage").slice(0, 80);
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    const url = `http://${localIpv4()}:${STAGE_PORT}/join?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
    return { url, room, token, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 280 }) };
  });
  ipcMain.handle("livevoz:concert-mode", (_event, enabled) => {
    if (!mainWindow) return false;
    mainWindow.setFullScreen(Boolean(enabled));
    return mainWindow.isFullScreen();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1040,
    minHeight: 650,
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "livevoz-logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "livevoz-v13-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDevelopment
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "livevoz-v13-stage.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("file:")) return { action: "allow" };
    if (isAllowedExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      if (isAllowedExternal(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("LiveVoz renderer finalizado:", details.reason);
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerIpc();

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = new Set(["media", "notifications", "fullscreen"]);
    callback(allowed.has(permission));
  });

  createWindow();
  startStage().catch((error) => console.error("No se pudo iniciar Stage Network:", error));
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (stageProcess) {
    try { stageProcess.kill("SIGTERM"); } catch (_e) {}
    stageProcess = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
