import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { protocol } from 'electron';
import { lessonMediaPath, lessonMediaScheme } from '../src/utils/lesson-media';

const mimeTypes: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
};

// Must run before the app is ready.
export function registerLessonMediaScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: lessonMediaScheme,
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true },
    },
  ]);
}

// One "bytes=start-end" range; null serves the whole file (also for multi-range requests).
export function parseRange(
  header: string | null,
  size: number
): { start: number; end: number } | null | 'unsatisfiable' {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? 'unsatisfiable' : { start, end };
}

// Seeking in <audio> relies on range responses, which file:// gave for free.
export function lessonMediaResponse(filePath: string, rangeHeader: string | null): Response {
  const size = fs.statSync(filePath).size;
  const headers: Record<string, string> = {
    'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  };
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  if (size === 0) return new Response(null, { status: 200, headers });
  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers['Content-Length'] = String(end - start + 1);
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export function handleLessonMedia(resolveAudio: (filePath: string) => string) {
  protocol.handle(lessonMediaScheme, request => {
    try {
      const filePath = resolveAudio(lessonMediaPath(request.url));
      return lessonMediaResponse(filePath, request.headers.get('range'));
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
