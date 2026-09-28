const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const esbuild = require('esbuild');

const source = esbuild.transformSync(
  fs.readFileSync(path.join(__dirname, '../src/utils/playback-shortcut.ts'), 'utf8'),
  { loader: 'ts', format: 'cjs' }
).code;
const scope = { module: { exports: {} } };
vm.runInNewContext(source, scope);
const { createPlaybackShortcut } = scope.module.exports;

function setup() {
  const state = { blocked: false, loaded: true, plays: 0 };
  const shortcut = createPlaybackShortcut({
    isBlocked: () => state.blocked,
    canPlay: () => state.loaded,
    togglePlay: () => state.plays++,
  });
  return { state, shortcut };
}

function key(target, overrides = {}) {
  return {
    code: 'Space',
    target: { closest: selector => (selector.split(', ').includes(target) ? {} : null) },
    prevented: false,
    stopped: false,
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
    ...overrides,
  };
}

for (const target of ['button', '.sentence-item', '.q-focus-helper', '[role="switch"]']) {
  test(`Space after clicking ${target} plays once without activating the focused control`, () => {
    const { state, shortcut } = setup();
    let previousAction = 0;
    const down = key(target);
    shortcut.keydown(down);
    if (!down.stopped) previousAction++; // Button keydown handler.
    const up = key(target);
    shortcut.keyup(up);
    if (!up.stopped) previousAction++; // QItem simulates a click on keyup.
    assert.equal(state.plays, 1);
    assert.equal(previousAction, 0);
    assert.equal(down.prevented && up.prevented, true);
  });
}

test('holding Space toggles once; the next press toggles again', () => {
  const { state, shortcut } = setup();
  shortcut.keydown(key('button'));
  for (let i = 0; i < 3; i++) shortcut.keydown(key('button', { repeat: true }));
  assert.equal(state.plays, 1);
  shortcut.keyup(key('button'));
  shortcut.keydown(key('button'));
  assert.equal(state.plays, 2);
});

test('editable controls and popup interactions retain their Space behavior', () => {
  for (const target of [
    'input',
    'textarea',
    'select',
    '[role="textbox"]',
    '[role="slider"]',
    '.q-menu',
    '[role="dialog"]',
    '[contenteditable]:not([contenteditable="false"])',
  ]) {
    const { state, shortcut } = setup();
    const down = key(target);
    const up = key(target);
    shortcut.keydown(down);
    shortcut.keyup(up);
    assert.equal(state.plays, 0);
    assert.equal(down.stopped || up.stopped, false);
  }
});

test('open menus or dialogs block the global shortcut', () => {
  const { state, shortcut } = setup();
  state.blocked = true;
  const down = key('button');
  shortcut.keydown(down);
  assert.equal(state.plays, 0);
  assert.equal(down.prevented, false);
});

test('modified Space and IME composition are left alone', () => {
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'isComposing']) {
    const { state, shortcut } = setup();
    const down = key('button', { [modifier]: true });
    shortcut.keydown(down);
    assert.equal(state.plays, 0);
    assert.equal(down.prevented, false);
  }
});

test('without a lesson, Space does not replay a button action', () => {
  const { state, shortcut } = setup();
  state.loaded = false;
  const down = key('button');
  const up = key('button');
  shortcut.keydown(down);
  shortcut.keyup(up);
  assert.equal(state.plays, 0);
  assert.equal(down.stopped && up.stopped, true);
});

test('losing window focus clears the held key state', () => {
  const { state, shortcut } = setup();
  shortcut.keydown(key('button'));
  shortcut.reset();
  shortcut.keydown(key('button'));
  assert.equal(state.plays, 2);
});
