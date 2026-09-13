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
  const expected = { playbackRate: 1.3, shadowing: true, repeatOne: true, drawerOpen: false, zenFirstAttempt: false, practiceMethod: 'replay' };
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
