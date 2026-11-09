const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadTs } = require('./helpers/load-ts.cjs');
const { createLessonAccess } = loadTs('src-electron/lesson-access.ts', { require });

const folder = path.resolve('/lessons/unit 1');
const lesson = {
  name: '01',
  audio: { path: folder, name: '01.mp3' },
  lyrics: { path: folder, name: '01.lrc' },
};

test('only lesson files from scanned folders resolve, by kind', () => {
  const access = createLessonAccess();
  const lyrics = path.join(folder, '01.lrc');
  assert.throws(() => access.resolveFile(lyrics, 'lyrics'), /已打开课程文件夹/);
  access.allowLessons([lesson]);
  assert.equal(access.resolveFile(lyrics, 'lyrics'), lyrics);
  // The renderer joins with "/", which still names the same file.
  assert.equal(access.resolveFile(folder + '/01.lrc', 'lyrics'), lyrics);
  assert.equal(access.resolveFile(path.join(folder, '01.mp3'), 'audio'), path.join(folder, '01.mp3'));
  assert.throws(() => access.resolveFile(path.join(folder, '01.mp3'), 'lyrics'));
  assert.throws(() => access.resolveFile(lyrics, 'audio'));
});

test('paths outside the opened lessons are refused', () => {
  const access = createLessonAccess();
  access.allowLessons([lesson]);
  for (const target of [
    path.join(folder, 'notes.txt'),
    path.join(folder, '..', 'secret.lrc'),
    path.join(folder, 'sub', '..', '..', '01.lrc'),
    '01.lrc',
    '',
    null,
    42,
    { path: folder },
  ]) {
    assert.throws(() => access.resolveFile(target, 'lyrics'), /已打开课程文件夹/, String(target));
  }
  // ".." that lands back on an opened file is the same file.
  assert.equal(
    access.resolveFile(path.join(folder, 'sub', '..', '01.lrc'), 'lyrics'),
    path.join(folder, '01.lrc')
  );
});

test('a lesson resolves only when both its audio and lyrics were opened', () => {
  const access = createLessonAccess();
  access.allowLessons([lesson]);
  assert.equal(access.resolveLesson(lesson), lesson);
  for (const bad of [
    { ...lesson, audio: { path: folder, name: '02.mp3' } },
    { ...lesson, lyrics: { path: '/etc', name: 'passwd' } },
    { ...lesson, lyrics: undefined },
    { name: 'x' },
    null,
  ]) {
    assert.throws(() => access.resolveLesson(bad), /已打开课程文件夹/);
  }
});

test('opening another folder keeps earlier lessons readable', () => {
  const access = createLessonAccess();
  const other = path.resolve('/lessons/unit 2');
  access.allowLessons([lesson]);
  access.allowLessons([{ name: '02', audio: { path: other, name: '02.m4a' }, lyrics: { path: other, name: '02.srt' } }]);
  assert.equal(access.resolveFile(path.join(folder, '01.lrc'), 'lyrics'), path.join(folder, '01.lrc'));
  assert.equal(access.resolveFile(path.join(other, '02.srt'), 'lyrics'), path.join(other, '02.srt'));
});
