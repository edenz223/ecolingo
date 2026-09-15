import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import type { SqlJsStatic, Database } from 'sql.js';
import type { Lesson, RecordingMetadata, RecordingClip } from '../src/types/recording';

import initSql from 'sql.js/dist/sql-asm.js';

const MAX_CLIP = 64 * 1024 * 1024;
const hash = (bytes: Buffer | Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

function atomicWrite(file: string, bytes: Buffer | Uint8Array) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    const fd = fs.openSync(temporary, 'r+');
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function rows<T = any>(db: Database, sql: string, params: any[] = []): T[] {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result: T[] = [];
    while (statement.step()) result.push(statement.getAsObject() as unknown as T);
    return result;
  } finally {
    statement.free();
  }
}

function validate(clip: any): asserts clip is RecordingClip {
  if (
    !clip ||
    !/^[a-f0-9-]{36}$/.test(clip.id) ||
    !/^[a-f0-9]{64}$/.test(clip.lessonId) ||
    !/^[a-f0-9]{64}$/.test(clip.checksum) ||
    typeof clip.mime !== 'string' ||
    clip.mime.length > 100 ||
    !['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'].includes(clip.mime.split(';')[0]) ||
    typeof clip.text !== 'string' ||
    clip.text.length > 100000 ||
    typeof clip.lessonName !== 'string' ||
    clip.lessonName.length > 1000 ||
    !Number.isFinite(clip.start) ||
    clip.start < 0 ||
    !Number.isFinite(clip.end) ||
    clip.end <= clip.start ||
    !Number.isSafeInteger(clip.createdAt) ||
    clip.createdAt < 0 ||
    !Number.isSafeInteger(clip.size) ||
    clip.size < 1 ||
    clip.size > MAX_CLIP
  ) {
    throw new Error('Invalid recording metadata.');
  }
}

export class RecordingStore {
  root: string;
  SQL: SqlJsStatic;
  index: string;
  db: Database;

  static async open(root: string): Promise<RecordingStore> {
    const SQL = await initSql();
    return new RecordingStore(root, SQL);
  }

  constructor(root: string, SQL: SqlJsStatic) {
    this.root = root;
    this.SQL = SQL;
    fs.mkdirSync(path.join(root, 'audio'), { recursive: true });
    this.index = path.join(root, 'index.sqlite');
    this.db = new SQL.Database(fs.existsSync(this.index) ? fs.readFileSync(this.index) : undefined);
    if (
      fs.existsSync(this.index) &&
      rows<{ user_version: number }>(this.db, 'PRAGMA user_version')[0].user_version !== 1
    ) {
      this.db.close();
      throw new Error('Unsupported recording database version.');
    }
    this.db.run(`CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY, lessonId TEXT NOT NULL, lessonName TEXT NOT NULL,
      start REAL NOT NULL, end REAL NOT NULL, text TEXT NOT NULL,
      createdAt INTEGER NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
      checksum TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS lesson_recordings ON recordings(lessonId, start, createdAt);
      PRAGMA user_version = 1;`);
    if (!fs.existsSync(this.index)) atomicWrite(this.index, this.db.export());
  }

  list(lessonId: string | null): RecordingClip[] {
    if (lessonId === null) {
      return rows<RecordingClip>(
        this.db,
        'SELECT * FROM recordings ORDER BY createdAt DESC, id DESC'
      );
    }
    return rows<RecordingClip>(
      this.db,
      'SELECT * FROM recordings WHERE lessonId = ? ORDER BY createdAt DESC, id DESC',
      [lessonId]
    );
  }

  audioPath(clip: RecordingClip): string {
    validate(clip);
    const extensions: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
    };
    return path.join(this.root, 'audio', `${clip.id}.${extensions[clip.mime.split(';')[0]]}`);
  }

  read(id: string): { bytes: Buffer; mime: string } {
    const clip = rows<RecordingClip>(this.db, 'SELECT * FROM recordings WHERE id = ?', [id])[0];
    if (!clip) throw new Error('Recording not found.');
    const bytes = fs.readFileSync(this.audioPath(clip));
    if (bytes.length !== clip.size || hash(bytes) !== clip.checksum) {
      throw new Error(
        'Recording audio is missing or damaged. Please record this sentence again.'
      );
    }
    return { bytes, mime: clip.mime };
  }

  save(meta: RecordingMetadata, data: Buffer | Uint8Array | ArrayBuffer): RecordingClip {
    const bytes = Buffer.from(data as any);
    const clip = {
      ...meta,
      id: randomUUID(),
      createdAt: Date.now(),
      size: bytes.length,
      checksum: hash(bytes),
    };
    validate(clip);
    // Persist audio before replacing the index; roll back a failed save.
    const snapshot = this.db.export();
    const file = this.audioPath(clip);
    let written = false;
    try {
      this.db.run('BEGIN');
      atomicWrite(file, bytes);
      written = true;
      this.db.run(
        'INSERT INTO recordings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          clip.id,
          clip.lessonId,
          clip.lessonName,
          clip.start,
          clip.end ?? null,
          clip.text,
          clip.createdAt,
          clip.mime,
          clip.size,
          clip.checksum,
        ]
      );
      this.db.run('COMMIT');
      atomicWrite(this.index, this.db.export());
      return clip;
    } catch (error) {
      this.db.close();
      this.db = new this.SQL.Database(snapshot);
      if (written) fs.rmSync(file, { force: true });
      throw error;
    }
  }
}

export async function lessonIdentity(lesson: Lesson): Promise<string> {
  const digest = createHash('sha256');
  for (const file of [lesson.audio, lesson.lyrics]) {
    const filePath = path.join(file.path, file.name);
    digest.update(String(fs.statSync(filePath).size) + ':');
    for await (const chunk of fs.createReadStream(filePath)) {
      digest.update(chunk as Buffer);
    }
  }
  return digest.digest('hex');
}
