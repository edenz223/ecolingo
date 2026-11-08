import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import type { FileAPI } from '../src/types/file-api';
import type { Lesson, RecordingMetadata } from '../src/types/recording';
import type { ThemePreference } from '../src/types/settings';

const fileAPI: FileAPI = {
  platform: process.platform,
  readTextFile: (filePath: string) => ipcRenderer.invoke('readTextFile', filePath),
  onFolderSelected: (callback: (event: IpcRendererEvent, values: Lesson[]) => void) =>
    ipcRenderer.on('folder-selected', callback),
  openFolder: () => ipcRenderer.invoke('openFolder'),
  openFolderPath: (folderPath: string) => ipcRenderer.invoke('openFolderPath', folderPath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  recordingIdentity: (lesson: Lesson) => ipcRenderer.invoke('recordings:identity', lesson),
  recordingCount: (lesson: Lesson) => ipcRenderer.invoke('recordings:count', lesson),
  listRecordings: (lessonId: string | null = null) =>
    ipcRenderer.invoke('recordings:list', lessonId),
  saveRecording: (meta: RecordingMetadata, bytes: ArrayBuffer) =>
    ipcRenderer.invoke('recordings:save', meta, bytes),
  readRecording: (id: string) => ipcRenderer.invoke('recordings:read', id),
  setFocusMode: (isFocus: boolean) => ipcRenderer.invoke('window:setFocusMode', isFocus),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke('window:setTheme', theme),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMax: boolean) => void) =>
    ipcRenderer.on('window:maximized-change', (_event, isMax: boolean) => callback(isMax)),
};

contextBridge.exposeInMainWorld('fileAPI', fileAPI);
