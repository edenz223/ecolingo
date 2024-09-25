import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("fileAPI", {
  onOpenFolder: (callback) =>
    ipcRenderer.on("open-folder", (event, value) => callback(value)),
  readTextFile: (filePath) => ipcRenderer.invoke("readTextFile", filePath),
});
