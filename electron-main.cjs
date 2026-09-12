const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("node:path");

const isDevelopment = !app.isPackaged;

function isAllowedExternal(url) {
  try {
    const parsed = new URL(url);
    return ["https:"].includes(parsed.protocol);
  } catch (_e) {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, "livevoz-logo.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: isDevelopment
    }
  });

  window.once("ready-to-show", () => window.show());
  window.loadFile(path.join(__dirname, "teleprompter-v11.html"), {
    query: { role: "operator" }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("file:")) return { action: "allow" };
    if (isAllowedExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file:")) {
      event.preventDefault();
      if (isAllowedExternal(url)) shell.openExternal(url);
    }
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("LiveVoz renderer finalizado:", details.reason);
  });

  if (isDevelopment) window.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = new Set(["media", "notifications", "fullscreen"]);
    callback(allowed.has(permission));
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
