const fs = require('fs');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const initSql = require('sql.js/dist/sql-asm.js');
const AdmZip = require('adm-zip');

const MAX_CLIP = 64 * 1024 * 1024;
const MAX_BACKUP = 512 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function atomicWrite(file, bytes) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: 'wx' });
    const fd = fs.openSync(temporary, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function rows(db, sql, params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally { statement.free(); }
}

function validate(clip) {
  if (!clip || !/^[a-f0-9-]{36}$/.test(clip.id) ||
      !/^[a-f0-9]{64}$/.test(clip.lessonId) ||
      !/^[a-f0-9]{64}$/.test(clip.checksum) ||
      typeof clip.mime !== 'string' || clip.mime.length > 100 ||
      !['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'].includes(clip.mime.split(';')[0]) ||
      typeof clip.text !== 'string' || clip.text.length > 100000 ||
      typeof clip.lessonName !== 'string' || clip.lessonName.length > 1000 ||
      !Number.isFinite(clip.start) || clip.start < 0 ||
      !Number.isFinite(clip.end) || clip.end <= clip.start ||
      !Number.isSafeInteger(clip.createdAt) || clip.createdAt < 0 ||
      !Number.isSafeInteger(clip.size) || clip.size < 1 || clip.size > MAX_CLIP) {
    throw new Error('Invalid recording metadata.');
  }
}

class RecordingStore {
  static async open(root) {
    const SQL = await initSql();
    return new RecordingStore(root, SQL);
  }

  constructor(root, SQL) {
    this.root = root;
    this.SQL = SQL;
    fs.mkdirSync(path.join(root, 'audio'), { recursive: true });
    this.index = path.join(root, 'index.sqlite');
    this.db = new SQL.Database(fs.existsSync(this.index) ? fs.readFileSync(this.index) : undefined);
    if (fs.existsSync(this.index) && rows(this.db, 'PRAGMA user_version')[0].user_version !== 1) {
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

  list(lessonId) {
    if (lessonId === null) return rows(this.db, 'SELECT * FROM recordings ORDER BY createdAt DESC, id DESC');
    return rows(this.db, 'SELECT * FROM recordings WHERE lessonId = ? ORDER BY createdAt DESC, id DESC', [lessonId]);
  }

  audioPath(clip) {
    validate(clip);
    const extensions = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav' };
    return path.join(this.root, 'audio', `${clip.id}.${extensions[clip.mime.split(';')[0]]}`);
  }

  read(id) {
    const clip = rows(this.db, 'SELECT * FROM recordings WHERE id = ?', [id])[0];
    if (!clip) throw new Error('Recording not found.');
    const bytes = fs.readFileSync(this.audioPath(clip));
    if (bytes.length !== clip.size || hash(bytes) !== clip.checksum) throw new Error('Recording audio is missing or damaged. Restore a backup.');
    return { bytes, mime: clip.mime };
  }

  save(meta, data) {
    const bytes = Buffer.from(data);
    const clip = { ...meta, id: randomUUID(), createdAt: Date.now(), size: bytes.length, checksum: hash(bytes) };
    validate(clip);
    this.merge([{ clip, bytes }]);
    return clip;
  }

  // Files are durable before the index is atomically replaced. Failed commits
  // restore the in-memory database and remove only files created by this call.
  merge(items) {
    const snapshot = this.db.export();
    const written = [];
    let added = 0;
    try {
      this.db.run('BEGIN');
      for (const { clip, bytes } of items) {
        const existing = rows(this.db, 'SELECT * FROM recordings WHERE id = ?', [clip.id])[0];
        if (existing) {
          if (Object.keys(existing).some((key) => existing[key] !== clip[key])) throw new Error('Conflicting recording ID in backup.');
          // Also repair missing or corrupt audio when restoring the same backup.
          const file = this.audioPath(existing);
          if (!fs.existsSync(file) || hash(fs.readFileSync(file)) !== clip.checksum) atomicWrite(file, bytes);
          continue;
        }
        const file = this.audioPath(clip);
        atomicWrite(file, bytes);
        written.push(file);
        this.db.run('INSERT INTO recordings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [clip.id, clip.lessonId, clip.lessonName, clip.start, clip.end, clip.text, clip.createdAt, clip.mime, clip.size, clip.checksum]);
        added++;
      }
      this.db.run('COMMIT');
      atomicWrite(this.index, this.db.export());
      return added;
    } catch (error) {
      this.db.close();
      this.db = new this.SQL.Database(snapshot);
      for (const file of written) fs.rmSync(file, { force: true });
      throw error;
    }
  }

  exportBackup(destination) {
    const clips = rows(this.db, 'SELECT * FROM recordings ORDER BY createdAt');
    const zip = new AdmZip();
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ format: 'ecolingo-recordings', version: 1 })));
    const index = Buffer.from(this.db.export());
    let total = index.length;
    zip.addFile('index.sqlite', index);
    for (const clip of clips) {
      total += clip.size;
      if (total > MAX_BACKUP) throw new Error('Backup exceeds the 512 MB limit.');
      zip.addFile(`audio/${path.basename(this.audioPath(clip))}`, this.read(clip.id).bytes);
    }
    atomicWrite(destination, zip.toBuffer());
    return { count: clips.length, path: destination };
  }

  restoreBackup(source) {
    if (fs.statSync(source).size > MAX_BACKUP) throw new Error('Backup exceeds the 512 MB limit.');
    const zip = new AdmZip(source);
    const entries = zip.getEntries();
    if (entries.length > 100000 || entries.reduce((sum, entry) => sum + entry.header.size, 0) > MAX_BACKUP ||
        new Set(entries.map((entry) => entry.entryName)).size !== entries.length) throw new Error('Invalid or oversized backup.');
    const manifest = JSON.parse(zip.readAsText('manifest.json'));
    if (manifest.format !== 'ecolingo-recordings' || manifest.version !== 1) throw new Error('Unsupported backup version.');
    const index = zip.readFile('index.sqlite');
    if (!index) throw new Error('Backup index is missing.');
    const imported = new this.SQL.Database(index);
    let items;
    try {
      if (rows(imported, 'PRAGMA user_version')[0].user_version !== 1 ||
          rows(imported, 'PRAGMA integrity_check')[0].integrity_check !== 'ok') throw new Error('Invalid backup database.');
      items = rows(imported, 'SELECT * FROM recordings').map((clip) => {
        validate(clip);
        const bytes = zip.readFile(`audio/${path.basename(this.audioPath(clip))}`);
        if (!bytes || bytes.length !== clip.size || hash(bytes) !== clip.checksum) throw new Error('Backup contains missing or damaged audio.');
        return { clip, bytes };
      });
    } finally { imported.close(); }
    // Never extract archive paths. Only validated IDs generate local filenames.
    const added = this.merge(items);
    return { added, skipped: items.length - added };
  }
}

async function lessonIdentity(lesson) {
  const digest = createHash('sha256');
  for (const file of [lesson.audio, lesson.lyrics]) {
    const filePath = path.join(file.path, file.name);
    digest.update(String(fs.statSync(filePath).size) + ':');
    for await (const chunk of fs.createReadStream(filePath)) digest.update(chunk);
  }
  return digest.digest('hex');
}

module.exports = { RecordingStore, lessonIdentity, atomicWrite };
