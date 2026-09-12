import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("fileAPI", {
  platform: process.platform,
  readTextFile: (filePath) => ipcRenderer.invoke("readTextFile", filePath),
  onFolderSelected: (callback) => ipcRenderer.on("folder-selected", callback),
  openFolder: () => ipcRenderer.invoke("openFolder"),
  recordingIdentity: (lesson) => ipcRenderer.invoke('recordings:identity', lesson),
  listRecordings: (lessonId = null) => ipcRenderer.invoke('recordings:list', lessonId),
  saveRecording: (meta, bytes) => ipcRenderer.invoke('recordings:save', meta, bytes),
  readRecording: (id) => ipcRenderer.invoke('recordings:read', id),
  setFocusMode: (isFocus) => ipcRenderer.invoke('window:setFocusMode', isFocus),
});
