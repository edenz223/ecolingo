import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("fileAPI", {
  readTextFile: (filePath) => ipcRenderer.invoke("readTextFile", filePath),
  onFolderSelected: (callback) => ipcRenderer.on("folder-selected", callback),
  openFolder: () => ipcRenderer.invoke("openFolder"),
  recordingIdentity: (lesson) => ipcRenderer.invoke('recordings:identity', lesson),
  listRecordings: (lessonId = null) => ipcRenderer.invoke('recordings:list', lessonId),
  saveRecording: (meta, bytes) => ipcRenderer.invoke('recordings:save', meta, bytes),
  readRecording: (id) => ipcRenderer.invoke('recordings:read', id),
  exportRecordings: () => ipcRenderer.invoke('recordings:export'),
  exportMergedRecording: (bytes) => ipcRenderer.invoke('recordings:export-wav', bytes),
  restoreRecordings: () => ipcRenderer.invoke('recordings:restore'),
});
