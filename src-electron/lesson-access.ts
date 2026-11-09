import path from 'path';
import type { Lesson, LessonFile } from '../src/types/recording';

type LessonFileKind = 'audio' | 'lyrics';

// The renderer only gets lesson files from folders the main process scanned
// (dialog, drop or menu), so IPC paths outside that set are refused.
export function createLessonAccess() {
  const files = new Map<string, LessonFileKind>();
  const filePath = (file: LessonFile) => path.resolve(file.path, file.name);

  function allowLessons(lessons: Lesson[]) {
    for (const lesson of lessons) {
      files.set(filePath(lesson.audio), 'audio');
      files.set(filePath(lesson.lyrics), 'lyrics');
    }
  }

  // Returns the normalized path of an opened lesson file of that kind, or throws.
  function resolveFile(target: unknown, kind: LessonFileKind): string {
    if (typeof target === 'string' && path.isAbsolute(target)) {
      const resolved = path.resolve(target);
      if (files.get(resolved) === kind) return resolved;
    }
    throw new Error('只能读取已打开课程文件夹中的课程文件。');
  }

  function resolveLesson(lesson: unknown): Lesson {
    const { audio, lyrics } = (lesson ?? {}) as Partial<Lesson>;
    for (const [file, kind] of [
      [audio, 'audio'],
      [lyrics, 'lyrics'],
    ] as const) {
      const valid = typeof file?.path === 'string' && typeof file?.name === 'string';
      resolveFile(valid ? path.join(file.path, file.name) : null, kind);
    }
    return lesson as Lesson;
  }

  return { allowLessons, resolveFile, resolveLesson };
}
