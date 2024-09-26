import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("fileAPI", {
  readTextFile: (filePath) => ipcRenderer.invoke("readTextFile", filePath),
  onFolderSelected: (callback) => ipcRenderer.on("folder-selected", callback),
  openFolder: () => ipcRenderer.invoke("openFolder"),
});
