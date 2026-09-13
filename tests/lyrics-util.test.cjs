const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const esbuild = require('esbuild');

const raw = fs.readFileSync(path.join(__dirname, '../src/utils/lyrics-util.ts'), 'utf8');
const source = esbuild.transformSync(raw, { loader: 'ts', format: 'cjs' }).code;
const scope = { exports: {}, module: {} };
scope.module.exports = scope.exports;
vm.runInNewContext(source, scope);
Object.assign(scope, scope.module.exports);

test('LRC omits sentences fully enclosed by common brackets', () => {
  const sentences = scope.parseLRC([
    '[00:01.00]Keep me',
    '[00:02.00]（旁白）',
    '[00:03.00][Music]',
    '[00:04.00]Keep (this) too',
    '[00:05.00](first) (second)',
    '[00:06.00]最后一句',
  ].join('\n'));

  assert.deepEqual(JSON.parse(JSON.stringify(sentences)), [
    { start: 1, end: 4, text: 'Keep me' },
    { start: 4, end: 5, text: 'Keep (this) too' },
    { start: 5, end: 6, text: '(first) (second)' },
    { start: 6, text: '最后一句' },
  ]);
});

test('SRT omits bracketed sentences while preserving multiline text', () => {
  const sentences = scope.parseSRT([
    '1\n00:00:01,000 --> 00:00:02,000\n【音乐】',
    '2\n00:00:02,000 --> 00:00:04,000\nHello\n(world)',
    '3\n00:00:04,000 --> 00:00:05,000\n{noise}',
  ].join('\n\n'));

  assert.deepEqual(JSON.parse(JSON.stringify(sentences)), [
    { start: 2, end: 4, text: 'Hello (world)' },
  ]);
});
