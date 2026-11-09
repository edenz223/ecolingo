// Lesson audio is served through this scheme rather than file:// so the window can keep
// webSecurity on; the main process (src-electron/lesson-media.ts) only serves scanned lessons.
export const lessonMediaScheme = 'lesson-media';

// The whole path is one encoded segment, so URL normalization cannot alter it.
export function lessonMediaUrl(filePath: string): string {
  return `${lessonMediaScheme}://lesson/${encodeURIComponent(filePath)}`;
}

export function lessonMediaPath(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}
