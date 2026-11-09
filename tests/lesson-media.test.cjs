const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadTs } = require('./helpers/load-ts.cjs');

const urls = loadTs('src/utils/lesson-media.ts', { URL });
const { parseRange, lessonMediaResponse } = loadTs('src-electron/lesson-media.ts', {
  require: id => (id === '../src/utils/lesson-media' ? urls : require(id)),
  Response,
  ReadableStream,
});

test('lesson media URLs round-trip POSIX and Windows paths', () => {
  for (const filePath of ['/home/me/lessons/002 02.mp3', 'C:\\Users\\me\\课程\\#1 ?.mp3', '/a/%41.mp3']) {
    const url = urls.lessonMediaUrl(filePath);
    assert.match(url, /^lesson-media:\/\/lesson\/[^/]+$/);
    assert.equal(urls.lessonMediaPath(url), filePath);
  }
});

test('byte ranges cover open-ended, suffix, clamped and invalid requests', () => {
  assert.equal(parseRange(null, 100), null);
  assert.equal(parseRange('bytes=0-1,5-6', 100), null);
  assert.equal(parseRange('items=0-1', 100), null);
  assert.equal(parseRange('bytes=-', 100), null);
  assert.deepEqual({ ...parseRange('bytes=0-', 100) }, { start: 0, end: 99 });
  assert.deepEqual({ ...parseRange('bytes=10-19', 100) }, { start: 10, end: 19 });
  assert.deepEqual({ ...parseRange('bytes=90-500', 100) }, { start: 90, end: 99 });
  assert.deepEqual({ ...parseRange('bytes=-30', 100) }, { start: 70, end: 99 });
  assert.deepEqual({ ...parseRange('bytes=-300', 100) }, { start: 0, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=20-10', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=-0', 100), 'unsatisfiable');
});

test('responses serve whole files and ranges with audio headers', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-media-'));
  try {
    const file = path.join(dir, 'Lesson.MP3');
    fs.writeFileSync(file, Buffer.from('0123456789'));

    const whole = lessonMediaResponse(file, null);
    assert.equal(whole.status, 200);
    assert.equal(whole.headers.get('content-type'), 'audio/mpeg');
    assert.equal(whole.headers.get('accept-ranges'), 'bytes');
    assert.equal(whole.headers.get('content-length'), '10');
    assert.equal(await whole.text(), '0123456789');

    const part = lessonMediaResponse(file, 'bytes=2-5');
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(part.headers.get('content-length'), '4');
    assert.equal(await part.text(), '2345');

    const tail = lessonMediaResponse(file, 'bytes=-3');
    assert.equal(await tail.text(), '789');

    const beyond = lessonMediaResponse(file, 'bytes=10-');
    assert.equal(beyond.status, 416);
    assert.equal(beyond.headers.get('content-range'), 'bytes */10');

    const empty = path.join(dir, 'empty.m4a');
    fs.writeFileSync(empty, '');
    const none = lessonMediaResponse(empty, null);
    assert.equal(none.status, 200);
    assert.equal(none.headers.get('content-type'), 'audio/mp4');
    assert.equal(await none.text(), '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
