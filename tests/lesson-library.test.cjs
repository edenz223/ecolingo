const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const esbuild = require('esbuild');

const source = esbuild.transformSync(
  fs.readFileSync(path.join(__dirname, '../src/utils/lesson-library.ts'), 'utf8'),
  { loader: 'ts', format: 'cjs' }
).code;
const scope = { module: { exports: {} } };
vm.runInNewContext(source, scope);
const { lessonKey, lessonFolderName, filterLessons, findResumeTarget } = scope.module.exports;

const lesson = (folder, name) => ({
  name,
  audio: { path: folder, name: `${name}.mp3` },
  lyrics: { path: folder, name: `${name}.lrc` },
});
const lessons = [lesson('D:\\英语\\New Concept', '001 Excuse me'), lesson('D:\\英语\\New Concept', '002 Sorry, sir')];

test('lesson keys use the full audio path so equal names in other folders differ', () => {
  assert.equal(lessonKey(lessons[0]), 'D:\\英语\\New Concept/001 Excuse me.mp3');
  assert.notEqual(lessonKey(lesson('/a', '01')), lessonKey(lesson('/b', '01')));
});

test('folder name works for Windows and POSIX paths', () => {
  assert.equal(lessonFolderName(lessons), 'New Concept');
  assert.equal(lessonFolderName([lesson('/home/me/lessons/', '01')]), 'lessons');
  assert.equal(lessonFolderName([]), '');
});

test('filtering is case-insensitive and keeps original indexes', () => {
  assert.deepEqual(filterLessons(lessons, ' sorry ').map(item => item.index), [1]);
  assert.deepEqual(filterLessons(lessons, '').map(item => item.index), [0, 1]);
  assert.equal(filterLessons(lessons, 'zzz').length, 0);
});

test('resume target needs the saved lesson to still be in the list', () => {
  const point = { lessonKey: lessonKey(lessons[1]), sentenceStart: 12.5, sentenceIndex: 4 };
  const target = findResumeTarget(lessons, point);
  assert.equal(target.index, 1);
  assert.equal(target.sentenceIndex, 4);
  assert.equal(findResumeTarget(lessons, null), null);
  assert.equal(findResumeTarget([lessons[0]], point), null);
});
