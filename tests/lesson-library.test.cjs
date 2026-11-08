const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTs } = require('./helpers/load-ts.cjs');

const { lessonKey, lessonFolderName, filterLessons, findResumeTarget } = loadTs('src/utils/lesson-library.ts');

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
