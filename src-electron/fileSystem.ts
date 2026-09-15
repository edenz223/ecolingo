import fs from 'fs';
import path from 'path';
import jschardet from 'jschardet';

export interface ProcessedLessonsResult {
  completeLessons: any[];
  incompleteLessons: string[];
}

abstract class FileStrategy {
  abstract isMatch(file: fs.Dirent): boolean;
  abstract process(lesson: Record<string, any>, file: fs.Dirent): void;
}

class AudioFileStrategy extends FileStrategy {
  isMatch(file: fs.Dirent): boolean {
    const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'];
    return audioExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
  }

  process(lesson: Record<string, any>, file: fs.Dirent): void {
    lesson.audio = file;
  }
}

class LyricsFileStrategy extends FileStrategy {
  isMatch(file: fs.Dirent): boolean {
    return file.name.endsWith('.lrc') || file.name.endsWith('.srt');
  }

  process(lesson: Record<string, any>, file: fs.Dirent): void {
    lesson.lyrics = file;
  }
}

export class FileProcessor {
  strategies: FileStrategy[];

  constructor() {
    this.strategies = [new AudioFileStrategy(), new LyricsFileStrategy()];
  }

  processFolder(folderPath: string): ProcessedLessonsResult {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });
    files
      .filter((file) => file.isFile())
      .sort((a, b) => a.name.localeCompare(b.name));

    const lessonMap = new Map<string, Record<string, any>>();

    for (const file of files) {
      const fileName = path.parse(file.name).name;
      let lesson = lessonMap.get(fileName);

      if (!lesson) {
        lesson = { name: fileName };
        lessonMap.set(fileName, lesson);
      }

      for (const strategy of this.strategies) {
        if (strategy.isMatch(file)) {
          strategy.process(lesson, file);
          break;
        }
      }
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
    const encoding = jschardet.detect(content);
    return new TextDecoder(encoding.encoding).decode(content);
  }
}
