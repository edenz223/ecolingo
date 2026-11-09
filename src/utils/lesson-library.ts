import type { Lesson } from '../types/recording';
import type { ResumePoint } from '../types/settings';

// Stable across launches and unique within a folder: the audio file's full path.
export function lessonKey(lesson: Lesson): string {
  return `${lesson.audio.path}/${lesson.audio.name}`;
}

// Name of the folder the lessons were opened from (all lessons share one folder).
export function lessonFolderName(lessons: Lesson[]): string {
  const folder = lessons[0]?.audio.path || '';
  return folder.split(/[\\/]/).filter(Boolean).pop() || folder;
}

// The saved position, if its lesson is still in the current list.
export function findResumeTarget(lessons: Lesson[], point: ResumePoint | null) {
  if (!point) return null;
  const index = lessons.findIndex(lesson => lessonKey(lesson) === point.lessonKey);
  const lesson = lessons[index];
  return lesson ? { index, lesson, sentenceIndex: point.sentenceIndex } : null;
}

export function filterLessons(lessons: Lesson[], query: string) {
  const needle = query.trim().toLocaleLowerCase();
  return lessons
    .map((lesson, index) => ({ lesson, index }))
    .filter(({ lesson }) => !needle || lesson.name.toLocaleLowerCase().includes(needle));
}
