import fs from 'fs';
import path from 'path';
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

// Ranges are answered with bounded in-memory chunks; <audio> asks for the rest as it plays.
// A streamed body left open by an aborted request (seeking, closing the window) can hang
// Electron's shutdown.
export const lessonMediaChunkBytes = 1024 * 1024;

// Seeking in <audio> relies on range responses, which file:// gave for free.
export async function lessonMediaResponse(
  filePath: string,
  rangeHeader: string | null
): Promise<Response> {
  const { size } = await fs.promises.stat(filePath);
  const headers: Record<string, string> = {
    'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  };
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  if (!range) {
    const body = await fs.promises.readFile(filePath);
    headers['Content-Length'] = String(body.length);
    return new Response(body, { status: 200, headers });
  }
  const { start } = range;
  const end = Math.min(range.end, start + lessonMediaChunkBytes - 1);
  const body = Buffer.alloc(end - start + 1);
  const file = await fs.promises.open(filePath);
  try {
    await file.read(body, 0, body.length, start);
  } finally {
    await file.close();
  }
  headers['Content-Length'] = String(body.length);
  headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  return new Response(body, { status: 206, headers });
}

export function handleLessonMedia(resolveAudio: (filePath: string) => string) {
  protocol.handle(lessonMediaScheme, async request => {
    try {
      const filePath = resolveAudio(lessonMediaPath(request.url));
      return await lessonMediaResponse(filePath, request.headers.get('range'));
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
