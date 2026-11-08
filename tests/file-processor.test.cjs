const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const raw = fs.readFileSync(path.join(__dirname, '../src-electron/fileSystem.ts'), 'utf8');
const source = esbuild.transformSync(raw, { loader: 'ts', format: 'cjs' }).code;
const scope = { require, TextDecoder, exports: {}, module: { exports: {} } };
vm.runInNewContext(source, scope);
const { FileProcessor } = scope.module.exports;

test('folders pair audio with subtitles in natural order and ignore unrelated entries', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-folder-'));
  try {
    for (const name of ['10.mp3', '10.lrc', '2.m4a', '2.srt', '1.MP3', '1.lrc', 'cover.jpg', 'notes.txt', 'only audio.mp3']) {
      fs.writeFileSync(path.join(folder, name), '');
    }
    fs.mkdirSync(path.join(folder, 'extra.mp3'));
    const { completeLessons, incompleteLessons } = new FileProcessor().processFolder(folder);
    assert.deepEqual(Array.from(completeLessons, lesson => lesson.name), ['1', '2', '10']);
    assert.deepEqual(Array.from(incompleteLessons), ['only audio']);
    assert.deepEqual({ ...completeLessons[1].audio }, { name: '2.m4a', path: folder });
    assert.deepEqual({ ...completeLessons[1].lyrics }, { name: '2.srt', path: folder });
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
