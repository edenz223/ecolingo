const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const raw = fs.readFileSync(path.join(__dirname, '../src-electron/recording-store.ts'), 'utf8');
const source = esbuild.transformSync(raw, { loader: 'ts', format: 'cjs' }).code;
const scope = {
  require,
  Buffer,
  console,
  setTimeout,
  clearTimeout,
  exports: {},
  module: { exports: {} }
};
vm.runInNewContext(source, scope);
const { RecordingStore, lessonIdentity } = scope.module.exports;


test('durable recordings, isolated lessons, validation and failed-save rollback', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-test-'));
  const stores = [];
  const open = async (name) => {
    const store = await RecordingStore.open(path.join(root, name));
    stores.push(store);
    return store;
  };
  try {
    const source = await open('source');
    const meta = { lessonId: 'a'.repeat(64), lessonName: '中文 lesson', start: 1, end: 2, text: '你好', mime: 'audio/webm;codecs=opus' };
    const first = source.save(meta, Buffer.from('first'));
    source.save(meta, Buffer.from('second'));
    source.save({ ...meta, lessonId: 'b'.repeat(64) }, Buffer.from('other lesson'));
    assert.equal(source.list(meta.lessonId).length, 2);
    const reopened = await open('source');
    assert.equal(reopened.list(null).length, 3);
    assert.equal(reopened.read(first.id).bytes.toString(), 'first');
    assert.equal(fs.readFileSync(source.index).toString('ascii', 0, 15), 'SQLite format 3');
    const target = source;
    const before = fs.readFileSync(target.index);
    fs.writeFileSync(target.audioPath(first), 'damaged');
    assert.throws(() => target.read(first.id), /damaged/);
    assert.deepEqual(fs.readFileSync(target.index), before);
    assert.throws(() => target.save({ ...meta, start: -1 }, Buffer.from('bad')), /metadata/);
    assert.throws(() => target.save(meta, Buffer.alloc(0)), /metadata/);
    // Simulated failed index replacement must roll back both the row and new file.
    const originalIndex = target.index;
    target.index = root; // rename over a directory fails on all platforms
    const filesBefore = fs.readdirSync(path.join(target.root, 'audio'));
    assert.throws(() => target.save(meta, Buffer.from('failed write')));
    target.index = originalIndex;
    assert.equal(target.list(null).length, 3);
    assert.deepEqual(fs.readdirSync(path.join(target.root, 'audio')), filesBefore);
  } finally {
    stores.forEach((store) => store.db.close());
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('lesson identity survives a folder move and separates changed content', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-identity-'));
  try {
    const lesson = { audio: { path: root, name: '中文 audio.mp3' }, lyrics: { path: root, name: '中文 audio.lrc' } };
    fs.writeFileSync(path.join(root, lesson.audio.name), 'audio');
    fs.writeFileSync(path.join(root, lesson.lyrics.name), '[00:01]你好');
    const before = await lessonIdentity(lesson);
    const moved = path.join(root, 'moved');
    fs.mkdirSync(moved);
    for (const file of [lesson.audio, lesson.lyrics]) {
      fs.renameSync(path.join(root, file.name), path.join(moved, file.name));
      file.path = moved;
    }
    assert.equal(await lessonIdentity(lesson), before);
    fs.appendFileSync(path.join(moved, lesson.audio.name), 'changed');
    assert.notEqual(await lessonIdentity(lesson), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
