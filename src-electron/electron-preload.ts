import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { FileAPI } from '../src/types/file-api';
import type { Lesson, RecordingMetadata } from '../src/types/recording';

const fileAPI: FileAPI = {
  platform: process.platform,
  readTextFile: (filePath: string) => ipcRenderer.invoke('readTextFile', filePath),
  onFolderSelected: (callback: (event: IpcRendererEvent, values: Lesson[]) => void) =>
    ipcRenderer.on('folder-selected', callback),
  openFolder: () => ipcRenderer.invoke('openFolder'),
  recordingIdentity: (lesson: Lesson) => ipcRenderer.invoke('recordings:identity', lesson),
  listRecordings: (lessonId: string | null = null) => ipcRenderer.invoke('recordings:list', lessonId),
  saveRecording: (meta: RecordingMetadata, bytes: ArrayBuffer) =>
    ipcRenderer.invoke('recordings:save', meta, bytes),
  readRecording: (id: string) => ipcRenderer.invoke('recordings:read', id),
  setFocusMode: (isFocus: boolean) => ipcRenderer.invoke('window:setFocusMode', isFocus),
};

contextBridge.exposeInMainWorld('fileAPI', fileAPI);
