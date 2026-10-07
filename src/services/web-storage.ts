import type { RecordingClip, RecordingMetadata, Lesson } from '../types/recording';
import { sha256 } from 'js-sha256';

export interface StoredLesson {
  id: string;
  name: string;
  audioName: string;
  audioBlob: Blob;
  lyricsName: string;
  lyricsText: string;
  createdAt: number;
}

export interface StoredRecording {
  id: string;
  lessonId: string;
  lessonName: string;
  start: number;
  end?: number;
  text: string;
  mime: string;
  size: number;
  checksum: string;
  createdAt: number;
  audioBlob: Blob;
}

const DB_NAME = 'ecolingo_pwa_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('当前浏览器环境不支持 IndexedDB'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('lessons')) {
        db.createObjectStore('lessons', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('recordings')) {
        const recordingStore = db.createObjectStore('recordings', { keyPath: 'id' });
        recordingStore.createIndex('lessonId', 'lessonId', { unique: false });
        recordingStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('无法打开本地数据库'));
    };
  });

  return dbPromise;
}

export async function calculateSha256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let uint8: Uint8Array;
  if (typeof data === 'string') {
    uint8 = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    uint8 = data;
  } else {
    uint8 = new Uint8Array(data);
  }

  // 1. 优先使用安全上下文下的硬件加速 Web Crypto API
  if (
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  ) {
    try {
      const buffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(digest));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // 失败则回退到 js-sha256
    }
  }

  // 2. 纯 JS 降级（确保在非安全上下文如局域网 HTTP 访问下依然正常工作）
  return sha256(uint8);
}

export async function computeLessonIdentity(
  audioBuffer: ArrayBuffer,
  lyricsText: string
): Promise<string> {
  const lyricsBuffer = new TextEncoder().encode(lyricsText);
  const combined = new Uint8Array(audioBuffer.byteLength + lyricsBuffer.byteLength);
  combined.set(new Uint8Array(audioBuffer), 0);
  combined.set(lyricsBuffer, audioBuffer.byteLength);
  return calculateSha256(combined);
}

// ----------------- 课程存储 -----------------

export async function saveStoredLesson(lesson: StoredLesson): Promise<void> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lessons', 'readwrite');
    const store = tx.objectStore('lessons');
    const req = store.put(lesson);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStoredLesson(id: string): Promise<StoredLesson | undefined> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lessons', 'readonly');
    const store = tx.objectStore('lessons');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStoredLessons(): Promise<StoredLesson[]> {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('lessons', 'readonly');
    const store = tx.objectStore('lessons');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

// ----------------- 录音存储 -----------------

const MAX_CLIP = 64 * 1024 * 1024;

function validateClip(clip: any): asserts clip is RecordingClip {
  if (
    !clip ||
    !/^[a-f0-9-]{36}$/.test(clip.id) ||
    !/^[a-f0-9]{64}$/.test(clip.lessonId) ||
    !/^[a-f0-9]{64}$/.test(clip.checksum) ||
    typeof clip.mime !== 'string' ||
    clip.mime.length > 100 ||
    !['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'].includes(clip.mime.split(';')[0]) ||
    typeof clip.text !== 'string' ||
    clip.text.length > 100000 ||
    typeof clip.lessonName !== 'string' ||
    clip.lessonName.length > 1000 ||
    !Number.isFinite(clip.start) ||
    clip.start < 0 ||
    !Number.isFinite(clip.end) ||
    clip.end <= clip.start ||
    !Number.isSafeInteger(clip.createdAt) ||
    clip.createdAt < 0 ||
    !Number.isSafeInteger(clip.size) ||
    clip.size < 1 ||
    clip.size > MAX_CLIP
  ) {
    throw new Error('录音元数据无效');
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // 降级使用纯 JS
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveWebRecording(
  meta: RecordingMetadata,
  bytes: ArrayBuffer
): Promise<RecordingClip> {
  const checksum = await calculateSha256(bytes);
  const id = generateUUID();
  const createdAt = Date.now();
  const size = bytes.byteLength;

  const clip: RecordingClip = {
    id,
    lessonId: meta.lessonId,
    lessonName: meta.lessonName,
    start: meta.start,
    end: meta.end,
    text: meta.text,
    mime: meta.mime,
    size,
    checksum,
    createdAt,
  };

  validateClip(clip);

  const stored: StoredRecording = {
    ...clip,
    audioBlob: new Blob([bytes], { type: meta.mime }),
  };

  const db = await getDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readwrite');
    const store = tx.objectStore('recordings');
    const req = store.put(stored);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return clip;
}

export async function listWebRecordings(lessonId?: string | null): Promise<RecordingClip[]> {
  const db = await getDatabase();
  const storedList = await new Promise<StoredRecording[]>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const store = tx.objectStore('recordings');
    if (lessonId) {
      const index = store.index('lessonId');
      const req = index.getAll(lessonId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }
  });

  storedList.sort((a, b) => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return b.id.localeCompare(a.id);
  });

  return storedList.map(item => ({
    id: item.id,
    lessonId: item.lessonId,
    lessonName: item.lessonName,
    start: item.start,
    end: item.end,
    text: item.text,
    mime: item.mime,
    size: item.size,
    checksum: item.checksum,
    createdAt: item.createdAt,
  }));
}

export async function readWebRecording(id: string): Promise<{ bytes: Uint8Array; mime: string }> {
  const db = await getDatabase();
  const record = await new Promise<StoredRecording | undefined>((resolve, reject) => {
    const tx = db.transaction('recordings', 'readonly');
    const store = tx.objectStore('recordings');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!record) {
    throw new Error('未找到该录音');
  }

  const arrayBuffer = await record.audioBlob.arrayBuffer();
  const checksum = await calculateSha256(arrayBuffer);
  if (arrayBuffer.byteLength !== record.size || checksum !== record.checksum) {
    throw new Error('录音音频缺失或损坏，请重新录制该句子。');
  }

  return {
    bytes: new Uint8Array(arrayBuffer),
    mime: record.mime,
  };
}

export async function resolveLessonIdentity(lesson: Lesson): Promise<string> {
  const path = lesson.audio.path || '';
  const match = path.match(/indexeddb:\/\/([^/]+)/);
  if (match && match[1]) {
    return match[1];
  }

  const all = await getAllStoredLessons();
  const found = all.find(item => item.name === lesson.name);
  if (found) return found.id;

  return calculateSha256(lesson.name);
}
