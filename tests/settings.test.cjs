const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const esbuild = require('esbuild');
const raw = fs.readFileSync(path.join(__dirname, '../src/utils/settings.ts'), 'utf8');
const source = esbuild.transformSync(raw, { loader: 'ts', format: 'cjs' }).code;
function session(storage) {
  const scope = { localStorage: storage, exports: {}, module: {} };
  scope.module.exports = scope.exports;
  vm.runInNewContext(source, scope);
  Object.assign(scope, scope.module.exports);
  return scope;
}

test('all supported preferences survive a new session, including false values', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const expected = { playbackRate: 1.3, shadowing: true, loopMode: 'one', repeatCount: 1, drawerOpen: false, zenFirstAttempt: false, practiceMethod: 'replay' };
  session(storage).saveSettings(expected);
  assert.equal(JSON.stringify(session(storage).loadSettings()), JSON.stringify(expected));
});

test('missing, malformed and invalid preferences fall back safely', () => {
  const defaults = JSON.stringify(session({ getItem: () => null }).loadSettings());
  for (const value of ['{', 'null', '[]', '{"playbackRate":0}']) {
    assert.equal(JSON.stringify(session({ getItem: () => value }).loadSettings()), defaults);
  }
  const partial = session({ getItem: () => '{"volume":25,"muted":true,"playbackRate":999,"shadowing":true}' }).loadSettings();
  assert.equal('volume' in partial, false);
  assert.equal('muted' in partial, false);
  assert.equal(partial.playbackRate, 1);
  assert.equal(partial.shadowing, true);
  assert.equal(partial.zenFirstAttempt, true);
  assert.equal(session({ getItem: () => '{"zenFirstAttempt":"false"}' }).loadSettings().zenFirstAttempt, true);
});

test('unavailable storage does not prevent learning', () => {
  const scope = session({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } });
  assert.equal(scope.loadSettings().playbackRate, 1);
  assert.doesNotThrow(() => scope.saveSettings({ playbackRate: 1.2 }));
});

test('loop modes persist and legacy repeat-one migrates', () => {
  for (const loopMode of ['off', 'list', 'one']) {
    const values = new Map();
    const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    session(storage).saveSettings({ loopMode });
    assert.equal(session(storage).loadSettings().loopMode, loopMode);
  }
  assert.equal(session({ getItem: () => '{"repeatOne":true}' }).loadSettings().loopMode, 'one');
  assert.equal(session({ getItem: () => '{"loopMode":"invalid"}' }).loadSettings().loopMode, 'off');
  assert.equal(session({ getItem: () => '{"loopMode":"list","repeatOne":true}' }).loadSettings().loopMode, 'list');
});


test('removed twice mode falls back to sequential playback', () => {
  for (const raw of ['{"loopMode":"twice"}', '{"loopMode":"twice","repeatOne":true}']) {
    assert.equal(session({ getItem: () => raw }).loadSettings().loopMode, 'off');
  }
});

test('repeat count persists and rejects malformed stored values', () => {
  for (const repeatCount of [1, 4, 99]) {
    assert.equal(session({ getItem: () => JSON.stringify({ repeatCount }) }).loadSettings().repeatCount, repeatCount);
  }
  for (const repeatCount of [0, -1, 100, 1.5, '3', null]) {
    assert.equal(session({ getItem: () => JSON.stringify({ repeatCount }) }).loadSettings().repeatCount, 1);
  }
});
