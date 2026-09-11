const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/settings.js'), 'utf8')
  .replaceAll('export function', 'function');
function session(storage) {
  const scope = { localStorage: storage };
  vm.runInNewContext(source, scope);
  return scope;
}

test('all preferences survive a new session, including zero volume and false values', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const expected = { volume: 0, muted: true, playbackRate: 1.3, shadowing: true, repeatOne: true, drawerOpen: false, zenFirstAttempt: false, practiceMethod: 'replay' };
  session(storage).saveSettings(expected);
  assert.equal(JSON.stringify(session(storage).loadSettings()), JSON.stringify(expected));
});

test('missing, malformed and invalid preferences fall back safely', () => {
  const defaults = JSON.stringify(session({ getItem: () => null }).loadSettings());
  for (const value of ['{', 'null', '[]', '{"volume":-1,"playbackRate":0,"muted":"true"}']) {
    assert.equal(JSON.stringify(session({ getItem: () => value }).loadSettings()), defaults);
  }
  const partial = session({ getItem: () => '{"volume":25,"playbackRate":999,"shadowing":true}' }).loadSettings();
  assert.equal(partial.volume, 25);
  assert.equal(partial.playbackRate, 1);
  assert.equal(partial.shadowing, true);
  assert.equal(partial.zenFirstAttempt, true);
  assert.equal(session({ getItem: () => '{"zenFirstAttempt":"false"}' }).loadSettings().zenFirstAttempt, true);
});

test('unavailable storage does not prevent learning', () => {
  const scope = session({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } });
  assert.equal(scope.loadSettings().volume, 100);
  assert.doesNotThrow(() => scope.saveSettings({ volume: 20 }));
});
