const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadTs } = require('./helpers/load-ts.cjs');
const { RecordingStore, lessonIdentity, createLessonIdentityCache } = loadTs('src-electron/recording-store.ts', {
  require,
  Buffer,
  console,
  setTimeout,
  clearTimeout,
});


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

test('sentence counts include each recorded sentence once per lesson', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-count-'));
  try {
    const store = await RecordingStore.open(root);
    const meta = { lessonId: 'c'.repeat(64), lessonName: 'L', start: 1, end: 2, text: 'a', mime: 'audio/webm' };
    store.save(meta, Buffer.from('one'));
    store.save(meta, Buffer.from('retake'));
    store.save({ ...meta, start: 3, end: 4 }, Buffer.from('two'));
    store.save({ ...meta, lessonId: 'd'.repeat(64) }, Buffer.from('other'));
    assert.equal(store.countSentences(meta.lessonId), 2);
    assert.equal(store.countSentences('e'.repeat(64)), 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('identity cache reuses hashes until a lesson file changes', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-identity-'));
  try {
    fs.writeFileSync(path.join(folder, 'a.mp3'), 'audio');
    fs.writeFileSync(path.join(folder, 'a.lrc'), '[00:00.00]hi');
    const lesson = { name: 'a', audio: { path: folder, name: 'a.mp3' }, lyrics: { path: folder, name: 'a.lrc' } };
    let calls = 0;
    const identify = createLessonIdentityCache(async (item) => { calls++; return lessonIdentity(item); });
    const first = await identify(lesson);
    assert.equal(await identify(lesson), first);
    assert.equal(calls, 1);
    fs.writeFileSync(path.join(folder, 'a.lrc'), '[00:00.00]changed subtitles');
    const changed = await identify(lesson);
    assert.equal(calls, 2);
    assert.notEqual(changed, first);
    assert.equal(changed, await lessonIdentity(lesson));
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
