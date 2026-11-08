const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTs } = require('./helpers/load-ts.cjs');

const playbackOptions = loadTs('src/utils/playback-options.ts');
const { createKeyboardShortcuts } = loadTs('src/utils/keyboard-shortcuts.ts', {
  require: () => playbackOptions,
});

function setup(overrides = {}) {
  const state = { focus: false, menu: false, blocked: false, lesson: true, calls: [], ...overrides };
  const record = name => (...args) => state.calls.push(args.length ? [name, ...args] : name);
  const handle = createKeyboardShortcuts({
    isFocusMode: () => state.focus,
    isMenuOpen: () => state.menu,
    closeMenus: record('closeMenus'),
    exitFocusMode: record('exitFocusMode'),
    isBlocked: () => state.blocked,
    hasLesson: () => state.lesson,
    pauseFollowing: record('pauseFollowing'),
    toggleShadowing: record('toggleShadowing'),
    previousSentence: record('previousSentence'),
    nextSentence: record('nextSentence'),
    previousLesson: record('previousLesson'),
    nextLesson: record('nextLesson'),
    compareSentence: record('compareSentence'),
    adjustPlaybackRate: record('adjustPlaybackRate'),
    resetPlaybackRate: record('resetPlaybackRate'),
    reload: record('reload'),
  });
  return { state, handle };
}

function key(code, { target = null, ...modifiers } = {}) {
  return {
    code,
    target: target && { closest: selector => (selector.split(', ').includes(target) ? {} : null) },
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    prevented: false,
    preventDefault() { this.prevented = true; },
    ...modifiers,
  };
}

test('single keys dispatch practice, navigation and speed commands', () => {
  const { state, handle } = setup();
  for (const code of ['KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyB', 'KeyC', 'KeyX', 'KeyZ']) {
    const event = key(code);
    handle(event);
    assert.equal(event.prevented, true, code);
  }
  assert.deepEqual(state.calls, [
    'toggleShadowing', 'previousSentence', 'nextSentence', 'previousLesson', 'nextLesson', 'compareSentence',
    ['adjustPlaybackRate', 0.1], ['adjustPlaybackRate', -0.1], 'resetPlaybackRate',
  ]);
});

test('plain R is left to the recording shortcut while Ctrl+R reloads', () => {
  const { state, handle } = setup();
  const plain = key('KeyR');
  handle(plain);
  assert.equal(plain.prevented, false);
  handle(key('KeyR', { ctrlKey: true }));
  assert.deepEqual(state.calls, ['reload']);
});

test('modifiers, interactive targets and blocking dialogs suppress shortcuts', () => {
  const { state, handle } = setup();
  handle(key('KeyD', { ctrlKey: true }));
  handle(key('KeyD', { altKey: true }));
  handle(key('KeyD', { metaKey: true }));
  for (const target of ['input', 'button', '[role="switch"]', '[contenteditable="true"]']) {
    handle(key('KeyD', { target }));
  }
  state.blocked = true;
  handle(key('KeyD'));
  assert.deepEqual(state.calls, []);
});

test('without a loaded lesson only lesson switching and reload work', () => {
  const { state, handle } = setup({ lesson: false });
  for (const code of ['KeyS', 'KeyA', 'KeyD', 'KeyB', 'KeyC', 'KeyZ', 'KeyQ', 'KeyE']) handle(key(code));
  handle(key('KeyR', { ctrlKey: true }));
  assert.deepEqual(state.calls, ['previousLesson', 'nextLesson', 'reload']);
});

test('scrolling keys pause sentence following without other commands', () => {
  const { state, handle } = setup();
  const event = key('PageDown');
  handle(event);
  assert.deepEqual(state.calls, ['pauseFollowing']);
  assert.equal(event.prevented, false);
});

test('Escape in focus mode closes open menus before leaving focus mode', () => {
  const { state, handle } = setup({ focus: true, menu: true });
  handle(key('Escape'));
  assert.deepEqual(state.calls, ['closeMenus']);
  state.menu = false;
  handle(key('Escape'));
  assert.deepEqual(state.calls, ['closeMenus', 'exitFocusMode']);
  state.focus = false;
  handle(key('Escape'));
  assert.equal(state.calls.length, 2);
});
