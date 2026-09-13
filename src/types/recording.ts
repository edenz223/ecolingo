export interface LessonFile {
  name: string;
  path: string;
}

export interface Lesson {
  name: string;
  audio: LessonFile;
  lyrics: LessonFile;
}

export interface RecordingMetadata {
  lessonId: string;
  lessonName: string;
  start: number;
  end?: number;
  text: string;
  mime: string;
  duration?: number;
}

export interface RecordingClip extends RecordingMetadata {
  id: string;
  createdAt: number;
  size: number;
  checksum: string;
}
