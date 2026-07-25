const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const Store = require("electron-store");

const store = new Store({ defaults: { theme: "system", recentFiles: [] } });

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "renderer/index.html"));
  return win;
}

ipcMain.handle("settings:get", (_e, key) => store.get(key));
ipcMain.handle("settings:set", (_e, key, value) => store.set(key, value));
ipcMain.handle("dialog:openFile", async () => "/tmp/example.txt");
ipcMain.on("window:minimize", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());

app.whenReady().then(() => {
  const win = createWindow();
  win.webContents.send("app:ready", { version: app.getVersion() });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
