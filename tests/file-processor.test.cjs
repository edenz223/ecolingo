const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { electronRequire, loadTs } = require('./helpers/load-ts.cjs');

const { FileProcessor } = loadTs('src-electron/fileSystem.ts', { require: electronRequire, TextDecoder });

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

// Real subtitle text in the encodings lessons commonly ship with.
const zh = '[00:01.00]今天天气很好，我们去公园散步吧。\n[00:04.50]我每天早上七点起床，然后吃早饭。\n[00:08.20]这本书讲的是一个关于友谊的故事。\n';
const ja = '[00:01.00]今日はとても良い天気ですね。\n[00:04.00]私は毎朝七時に起きて、朝ご飯を食べます。\n[00:08.00]この本は友情についての物語です。\n';
const encoded = {
  gbk: '5b30303a30312e30305dbdf1ccecccecc6f8badcbac3a3acced2c3c7c8a5b9abd4b0c9a2b2bdb0c9a1a30a5b30303a30342e35305dced2c3bfccecd4e7c9cfc6dfb5e3c6f0b4b2a3acc8bbbaf3b3d4d4e7b7b9a1a30a5b30303a30382e32305dd5e2b1becae9bdb2b5c4cac7d2bbb8f6b9d8d3dad3d1d2eab5c4b9cacac2a1a30a',
  shiftJis: '5b30303a30312e30305d8da193fa82cd82c682c482e097c782a293568b4382c582b782cb81420a5b30303a30342e30305d8e8482cd968892a98eb58e9e82c98b4e82ab82c4814192a982b294d182f0904882d782dc82b781420a5b30303a30382e30305d82b182cc967b82cd97468fee82c982c282a282c482cc95a88cea82c582b781420a',
};

test('subtitles decode from UTF-8, UTF-8 with BOM, GBK and Shift_JIS', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ecolingo-encoding-'));
  try {
    const read = (name, bytes) => {
      const file = path.join(folder, name);
      fs.writeFileSync(file, bytes);
      return new FileProcessor().readTextFile(file);
    };
    assert.equal(read('utf8.lrc', Buffer.from(zh)), zh);
    assert.equal(read('bom.lrc', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(zh)])), zh);
    assert.equal(read('gbk.lrc', Buffer.from(encoded.gbk, 'hex')), zh);
    assert.equal(read('sjis.lrc', Buffer.from(encoded.shiftJis, 'hex')), ja);
    assert.equal(read('empty.lrc', Buffer.alloc(0)), '');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
