import type { Lesson, RecordingMetadata, RecordingClip } from './recording';

export interface FileAPI {
  platform: string;
  readTextFile(filePath: string): Promise<string>;
  onFolderSelected(callback: (event: any, values: Lesson[]) => void): void;
  openFolder(): Promise<void>;
  recordingIdentity(lesson: Lesson): Promise<string>;
  listRecordings(lessonId?: string | null): Promise<RecordingClip[]>;
  saveRecording(meta: RecordingMetadata, bytes: ArrayBuffer): Promise<RecordingClip>;
  readRecording(id: string): Promise<{ bytes: Uint8Array | Buffer; mime: string }>;
  setFocusMode?(isFocus: boolean): Promise<void>;
}

declare global {
  interface Window {
    fileAPI: FileAPI;
  }
}
