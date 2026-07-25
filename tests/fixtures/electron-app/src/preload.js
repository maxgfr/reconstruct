const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (key, value) => ipcRenderer.invoke("settings:set", key, value),
  openFile: () => ipcRenderer.invoke("dialog:openFile"),
  minimize: () => ipcRenderer.send("window:minimize"),
  onReady: (cb) => ipcRenderer.on("app:ready", (_e, payload) => cb(payload)),
});
