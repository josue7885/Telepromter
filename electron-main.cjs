const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const isDevelopment = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#050505",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "livevoz-logo.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, "teleprompter.html"), {
    query: { role: "operator" }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("file:")) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDevelopment) window.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
