import jschardet from 'jschardet';
import type { Lesson } from '../types/recording';
import { computeLessonIdentity, saveStoredLesson, type StoredLesson } from './web-storage';

export interface ProcessedFilesResult {
  completeLessons: Lesson[];
  incompleteLessons: string[];
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];
const LYRICS_EXTENSIONS = ['.lrc', '.srt'];

function getBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return fileName;
  return fileName.substring(0, lastDot);
}

function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.substring(lastDot).toLowerCase();
}

export async function decodeTextFile(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const detected = jschardet.detect(uint8);
  const encoding = detected && detected.encoding ? detected.encoding : 'utf-8';
  try {
    return new TextDecoder(encoding).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

export async function processFiles(files: File[]): Promise<ProcessedFilesResult> {
  const lessonMap = new Map<string, { audioFile?: File; lyricsFile?: File; baseName: string }>();

  for (const file of files) {
    const ext = getExtension(file.name);
    const baseName = getBaseName(file.name);

    let entry = lessonMap.get(baseName);
    if (!entry) {
      entry = { baseName };
      lessonMap.set(baseName, entry);
    }

    if (AUDIO_EXTENSIONS.includes(ext)) {
      entry.audioFile = file;
    } else if (LYRICS_EXTENSIONS.includes(ext)) {
      entry.lyricsFile = file;
    }
  }

  const incompleteLessons: string[] = [];
  const completeLessons: Lesson[] = [];

  for (const [baseName, entry] of lessonMap.entries()) {
    if (!entry.audioFile || !entry.lyricsFile) {
      incompleteLessons.push(baseName);
      continue;
    }

    const audioBuffer = await entry.audioFile.arrayBuffer();
    const lyricsText = await decodeTextFile(entry.lyricsFile);
    const lessonId = await computeLessonIdentity(audioBuffer, lyricsText);

    const storedLesson: StoredLesson = {
      id: lessonId,
      name: baseName,
      audioName: entry.audioFile.name,
      audioBlob: entry.audioFile,
      lyricsName: entry.lyricsFile.name,
      lyricsText,
      createdAt: Date.now(),
    };

    await saveStoredLesson(storedLesson);

    const lesson: Lesson = {
      name: baseName,
      audio: {
        name: entry.audioFile.name,
        path: `indexeddb://${lessonId}/audio`,
      },
      lyrics: {
        name: entry.lyricsFile.name,
        path: `indexeddb://${lessonId}/lyrics`,
      },
    };

    completeLessons.push(lesson);
  }

  return { completeLessons, incompleteLessons };
}

export function selectFilesFromBrowser(mode: 'directory' | 'files' = 'files'): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    if (mode === 'directory') {
      input.webkitdirectory = true;
      (input as any).directory = true;
    } else {
      input.accept =
        '.mp3,.wav,.ogg,.aac,.flac,.m4a,.lrc,.srt,.MP3,.WAV,.OGG,.AAC,.FLAC,.M4A,.LRC,.SRT,audio/*';
    }

    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let finished = false;
    const done = (files: File[]) => {
      if (finished) return;
      finished = true;
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
      resolve(files);
    };

    input.addEventListener('change', () => {
      const fileList = input.files;
      const files: File[] = fileList ? Array.from(fileList) : [];
      done(files);
    });

    input.addEventListener('cancel', () => {
      done([]);
    });

    input.click();
  });
}
