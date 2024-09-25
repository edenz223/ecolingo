import fs from "fs";
import path from "path";
const jschardet = require("jschardet");

class FileStrategy {
  isMatch(file) {
    throw new Error("isMatch method must be implemented");
  }

  process(lesson, file) {
    throw new Error("process method must be implemented");
  }
}

class AudioFileStrategy extends FileStrategy {
  isMatch(file) {
    const audioExtensions = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"];
    return audioExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
  }

  process(lesson, file) {
    lesson.audio = file;
  }
}

class LyricsFileStrategy extends FileStrategy {
  isMatch(file) {
    return file.name.endsWith(".lrc") || file.name.endsWith(".srt");
  }

  process(lesson, file) {
    lesson.lyrics = file;
  }
}

export class FileProcessor {
  constructor() {
    this.strategies = [new AudioFileStrategy(), new LyricsFileStrategy()];
  }

  processFolder(folderPath) {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });
    files
      .filter((file) => file.isFile())
      .sort((a, b) => a.name.localeCompare(b.name));

    const lessonMap = new Map();

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

    const incompleteLessons = [];
    const completeLessons = [];
    for (const [name, lesson] of lessonMap) {
      if (!lesson.audio || !lesson.lyrics) {
        incompleteLessons.push(name);
      } else {
        completeLessons.push(lesson);
      }
    }

    return { completeLessons, incompleteLessons };
  }

  readTextFile(filePath) {
    const content = fs.readFileSync(filePath);
    const encoding = jschardet.detect(content, {
      // detectEncodings: ["UTF-8", "Big5"],
    });
    return new TextDecoder(encoding.encoding).decode(content);
  }
}
