import type { FileAPI } from '../types/file-api';
import type { Lesson, RecordingClip, RecordingMetadata } from '../types/recording';
import {
  getStoredLesson,
  listWebRecordings,
  readWebRecording,
  resolveLessonIdentity,
  saveWebRecording,
} from './web-storage';
import { processFiles, selectFilesFromBrowser } from './file-import';
import { Dialog, Notify } from 'quasar';

type FolderCallback = (event: any, values: Lesson[]) => void;

class WebFileAPI implements FileAPI {
  platform = 'web';
  private folderCallbacks: Set<FolderCallback> = new Set();
  private activeBlobUrls: Set<string> = new Set();

  onFolderSelected(callback: FolderCallback): void {
    this.folderCallbacks.add(callback);
  }

  async openFolder(mode: 'files' | 'directory' = 'directory'): Promise<void> {
    return this.importFiles(mode);
  }

  async openFiles(): Promise<void> {
    return this.importFiles('files');
  }

  private async importFiles(mode: 'files' | 'directory'): Promise<void> {
    let files: File[] = [];
    try {
      files = await selectFilesFromBrowser(mode);
    } catch (err) {
      console.error('File selection error', err);
      return;
    }

    if (!files || !files.length) {
      return;
    }

    try {
      Notify.create({
        type: 'info',
        message: `正在解析 ${files.length} 个文件…`,
        timeout: 1200,
      });

      const { completeLessons, incompleteLessons } = await processFiles(files);

      if (incompleteLessons.length > 0) {
        Dialog.create({
          title: '课程未完全配对',
          message: `以下课程缺少同名的音频或字幕文件，已跳过：\n${incompleteLessons.join(
            ', '
          )}\n\n提示：同名音频（如 lesson.mp3）与字幕（如 lesson.lrc 或 .srt）需同时选中导入。`,
          ok: '确定',
        });
      }

      if (completeLessons.length > 0) {
        for (const cb of this.folderCallbacks) {
          cb({}, completeLessons);
        }
        Notify.create({
          type: 'positive',
          message: `成功导入 ${completeLessons.length} 门课程！`,
          timeout: 2000,
        });
      } else {
        Dialog.create({
          title: '未成功识别课程',
          message:
            '未识别到配对的音频和字幕文件。\n请确保将同名的音频（如 lesson.mp3）和字幕（如 lesson.lrc 或 .srt）文件同时选中导入。',
          ok: '确定',
        });
      }
    } catch (err: any) {
      console.error('Import failed', err);
      Notify.create({
        type: 'negative',
        message: `导入失败：${err.message || '未知错误'}`,
      });
    }
  }

  async readTextFile(filePath: string): Promise<string> {
    const match = filePath.match(/indexeddb:\/\/([^/]+)\/lyrics/);
    const lessonId = match ? match[1] : '';

    if (lessonId) {
      const stored = await getStoredLesson(lessonId);
      if (stored && stored.lyricsText) {
        return stored.lyricsText;
      }
    }

    throw new Error(`无法读取字幕文件：${filePath}`);
  }

  async getAudioUrl(audioPath: string, lesson?: Lesson): Promise<string> {
    const match = audioPath.match(/indexeddb:\/\/([^/]+)\/audio/);
    let lessonId = match ? match[1] : '';

    if (!lessonId && lesson) {
      lessonId = await resolveLessonIdentity(lesson);
    }

    if (lessonId) {
      const stored = await getStoredLesson(lessonId);
      if (stored && stored.audioBlob) {
        const url = URL.createObjectURL(stored.audioBlob);
        this.activeBlobUrls.add(url);
        return url;
      }
    }

    return audioPath;
  }

  releaseAudioUrl(url: string): void {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
      this.activeBlobUrls.delete(url);
    }
  }

  recordingIdentity(lesson: Lesson): Promise<string> {
    return resolveLessonIdentity(lesson);
  }

  listRecordings(lessonId?: string | null): Promise<RecordingClip[]> {
    return listWebRecordings(lessonId);
  }

  saveRecording(meta: RecordingMetadata, bytes: ArrayBuffer): Promise<RecordingClip> {
    return saveWebRecording(meta, bytes);
  }

  readRecording(id: string): Promise<{ bytes: Uint8Array; mime: string }> {
    return readWebRecording(id);
  }

  async setFocusMode(_isFocus: boolean): Promise<void> {
    // Web 环境下无需调用系统边框操作
  }

  async minimize(): Promise<void> {
    // 浏览器环境不支持最小化窗口
  }

  async maximize(): Promise<boolean> {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      await document.exitFullscreen().catch(() => {});
      return false;
    }
  }

  async close(): Promise<void> {
    window.close();
  }

  async isMaximized(): Promise<boolean> {
    return Boolean(document.fullscreenElement);
  }

  onMaximizedChange(callback: (isMax: boolean) => void): void {
    document.addEventListener('fullscreenchange', () => {
      callback(Boolean(document.fullscreenElement));
    });
  }
}

export function initWebFileAPI(): void {
  if (typeof window === 'undefined') return;

  // 如果已经由 Electron Preload 注入，则不覆盖原生 API
  if (window.fileAPI && window.fileAPI.platform !== 'web') {
    return;
  }

  window.fileAPI = new WebFileAPI();
}
