import type { Lesson, RecordingMetadata, RecordingClip } from './recording';

export interface FileAPI {
  platform: string;
  readTextFile(filePath: string): Promise<string>;
  onFolderSelected(callback: (event: any, values: Lesson[]) => void): void;
  openFolder(): Promise<void>;
  // Opens a dropped folder, or the folder containing a dropped file; false if unreadable.
  openFolderPath?(folderPath: string): Promise<boolean>;
  getPathForFile?(file: File): string;
  recordingIdentity(lesson: Lesson): Promise<string>;
  // Distinct sentences with at least one saved take.
  recordingCount?(lesson: Lesson): Promise<number>;
  listRecordings(lessonId?: string | null): Promise<RecordingClip[]>;
  saveRecording(meta: RecordingMetadata, bytes: ArrayBuffer): Promise<RecordingClip>;
  readRecording(id: string): Promise<{ bytes: Uint8Array | Buffer; mime: string }>;
  setFocusMode?(isFocus: boolean): Promise<void>;
  minimize?(): Promise<void>;
  maximize?(): Promise<boolean>;
  close?(): Promise<void>;
  isMaximized?(): Promise<boolean>;
  onMaximizedChange?(callback: (isMax: boolean) => void): void;
}

declare global {
  interface Window {
    fileAPI: FileAPI;
  }
}
