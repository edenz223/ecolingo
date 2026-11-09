import fs from 'fs';
import path from 'path';
import { detect } from 'jschardet';
import type { Lesson, LessonFile } from '../src/types/recording';

export interface ProcessedLessonsResult {
  completeLessons: Lesson[];
  incompleteLessons: string[];
}

abstract class FileStrategy {
  abstract isMatch(file: fs.Dirent): boolean;
  abstract process(lesson: Record<string, any>, file: LessonFile): void;
}

class AudioFileStrategy extends FileStrategy {
  isMatch(file: fs.Dirent): boolean {
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];
    return audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  process(lesson: Record<string, any>, file: LessonFile): void {
    lesson.audio = file;
  }
}

class LyricsFileStrategy extends FileStrategy {
  isMatch(file: fs.Dirent): boolean {
    return file.name.endsWith('.lrc') || file.name.endsWith('.srt');
  }

  process(lesson: Record<string, any>, file: LessonFile): void {
    lesson.lyrics = file;
  }
}

// jschardet reports chardet's encoding names; these are the ones TextDecoder rejects.
const decoderLabels: Record<string, string> = {
  'utf-8-sig': 'utf-8',
  'utf-16-be': 'utf-16be',
  'utf-16-le': 'utf-16le',
  cp932: 'shift_jis',
  shift_jis_2004: 'shift_jis',
  euc_jis_2004: 'euc-jp',
  iso2022_jp_2: 'iso-2022-jp',
  cp949: 'euc-kr',
  euc_kr: 'euc-kr',
  big5hkscs: 'big5',
  cp874: 'windows-874',
  'mac-roman': 'macintosh',
  'mac-cyrillic': 'x-mac-cyrillic',
};

export class FileProcessor {
  strategies: FileStrategy[];

  constructor() {
    this.strategies = [new AudioFileStrategy(), new LyricsFileStrategy()];
  }

  processFolder(folderPath: string): ProcessedLessonsResult {
    // Natural order so "2" sorts before "10"; folders and unrelated files are ignored.
    const files = fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter(file => file.isFile())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

    const lessonMap = new Map<string, Record<string, any>>();

    for (const file of files) {
      const strategy = this.strategies.find(item => item.isMatch(file));
      if (!strategy) continue;
      const fileName = path.parse(file.name).name;
      let lesson = lessonMap.get(fileName);

      if (!lesson) {
        lesson = { name: fileName };
        lessonMap.set(fileName, lesson);
      }
      strategy.process(lesson, { name: file.name, path: folderPath });
    }

    const incompleteLessons: string[] = [];
    const completeLessons: any[] = [];
    for (const [name, lesson] of lessonMap) {
      if (!lesson.audio || !lesson.lyrics) {
        incompleteLessons.push(name);
      } else {
        completeLessons.push(lesson);
      }
    }

    return { completeLessons, incompleteLessons };
  }

  readTextFile(filePath: string): string {
    const content = fs.readFileSync(filePath);
    // Encodings TextDecoder cannot decode fall back to UTF-8.
    const encoding = detect(content).encoding?.toLowerCase() ?? 'utf-8';
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(decoderLabels[encoding] ?? encoding);
    } catch {
      decoder = new TextDecoder('utf-8');
    }
    return decoder.decode(content);
  }
}
