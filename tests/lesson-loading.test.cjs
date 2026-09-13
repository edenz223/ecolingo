const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const stripModule = (filePath) =>
  esbuild.transformSync(fs.readFileSync(filePath, 'utf8'), { loader: 'ts', format: 'esm' }).code
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export (\{.*\}|default |const |class |function |let |var )/gm, '$1')
    .replace(/^export \{[\s\S]*?\};?\r?\n/gm, '');

const playerSource = stripModule(path.join(root, 'src/modules/player.ts'));
const recorderSource = stripModule(path.join(root, 'src/modules/recorder.ts'));

function setup() {
  const reads = new Map();
  const sounds = [];
  const frames = new Map();
  let frameId = 0;
  const shadowingMode = { value: false };
  const recordingEvents = [];
  class Howl {
    constructor(options) { this.options = options; this.unloaded = false; sounds.push(this); }
    load() {}
    unload() { this.unloaded = true; this.active = false; }
    duration() { return 10; }
    playing() { return !!this.active; }
    pause() { this.active = false; }
    volume() {}
    seek(value) { if (value !== undefined) this.position = value; return this.position || 0; }
    play() { this.active = true; this.options.onplay(); }
  }
  const context = vm.createContext({
    ref: value => ({ value }), Howl, console,
    window: { fileAPI: { readTextFile: path => new Promise((resolve, reject) => reads.set(path, { resolve, reject })) } },
    parseLRC: text => [{ start: 0, text }],
    shadowingMode,
    startSentenceRecording(sentence) { recordingEvents.push(['start', sentence.text]); },
    stopSentenceRecording() { recordingEvents.push(['stop']); }, previewAudio: null,
    document: { getElementById() { return null; } },
    setTimeout: callback => { frames.set(++frameId, callback); return frameId; },
    clearTimeout: id => frames.delete(id),
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
  });
  vm.runInContext(playerSource, context);
  const player = vm.runInContext(`
    const p = new Player();
    p.setCallbacks({
      onSentenceBoundary: (sentence) => {
        if (shadowingMode.value) {
          p.sound.value?.pause();
          if (p.stepTimerId) clearTimeout(p.stepTimerId);
          p.isShadowing.value = true;
          startSentenceRecording(sentence);
          return true;
        }
        return false;
      }
    });
    p;
  `, context);
  const lesson = name => ({ name, lyrics: { path: '/lessons', name: `${name}.lrc` }, audio: { path: '/lessons', name: `${name}.mp3` } });
  const resolve = (name) => reads.get(`/lessons/${name}.lrc`).resolve(name);
  return { player, sounds, frames, lesson, resolve, shadowingMode, recordingEvents };
}

test('late transcript cannot replace the latest lesson', async () => {
  const { player, sounds, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  const b = player.playLesson(lesson('B'));
  resolve('B'); await b;
  sounds[0].options.onload();
  resolve('A'); await a;
  assert.equal(sounds.length, 1);
  assert.equal(player.currentLesson.name, 'B');
  assert.equal(player.parsedSentences.value[0].text, 'B');
  assert.equal(player.sound.value, sounds[0]);
});

test('pending audio is unloaded and late audio callbacks are ignored', async () => {
  const { player, sounds, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  resolve('A'); await a;
  const pending = sounds[0];
  const b = player.playLesson(lesson('B'));
  assert.equal(pending.unloaded, true);
  pending.options.onload();
  assert.equal(player.currentLesson.name, 'B');
  assert.equal(player.sound.value, null);
  resolve('B'); await b;
  sounds[1].options.onload();
  assert.equal(player.currentLesson.name, 'B');
  assert.equal(player.sound.value, sounds[1]);
});

test('switching releases active audio and stale animation callbacks', async () => {
  const { player, sounds, frames, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  resolve('A'); await a;
  sounds[0].options.onload();
  assert.equal(player.sound.value, sounds[0]);
  const active = sounds[0];
  player.stepTimerId = 123;
  frames.set(123, () => { throw new Error('stale timer'); });
  const b = player.playLesson(lesson('B'));
  assert.equal(active.unloaded, true);
  assert.equal(player.sound.value, null);
  assert.equal(frames.has(123), false);
  resolve('B'); await b;
  sounds[1].options.onload();
  assert.equal(player.sound.value, sounds[1]);
});

test('teardown invalidates a pending transcript', async () => {
  const { player, sounds, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  player.releaseLesson();
  resolve('A'); await a;
  assert.equal(sounds.length, 0);
  assert.equal(player.sound.value, null);
  assert.equal(player.currentLesson, null);
});

test('audio end starts the final shadow interval and then stops cleanly', async () => {
  const { player, sounds, lesson, resolve, shadowingMode, recordingEvents } = setup();
  shadowingMode.value = true;
  const a = player.playLesson(lesson('A'));
  resolve('A'); await a;
  sounds[0].options.onload();
  sounds[0].active = false;
  sounds[0].options.onend();
  assert.equal(player.isShadowing.value, true);
  assert.equal(recordingEvents.length, 1);
  assert.equal(recordingEvents[0][0], 'start');
  player.step();
  assert.equal(recordingEvents.length, 1);
});

test('timer advances listen-shadow-listen even while transcript is scrolling', async () => {
  const { player, sounds, frames, lesson, resolve, shadowingMode, recordingEvents } = setup();
  shadowingMode.value = true;
  const a = player.playLesson(lesson('A'));
  resolve('A'); await a;
  sounds[0].options.onload();
  sounds[0].position = 10;
  player.step();
  assert.equal(player.isShadowing.value, true);
  assert.equal(recordingEvents.length, 1);
  player.isScrolling.value = true;
  for (const [, callback] of Array.from(frames.entries())) {
    callback();
  }
  assert.equal(player.isShadowing.value, true);
});

test('repeat-one restarts after final shadow interval', async () => {
  const { player, sounds, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  resolve('A'); await a;
  sounds[0].options.onload();
  player.repeatOne.value = true;
  for (let i = 0; i < 2; i++) {
    sounds[0].active = false;
    sounds[0].options.onend();
  }
  assert.equal(player.isShadowing.value, false);
  assert.equal(sounds[0].playing(), true);
  assert.equal(sounds[0].position, 0);
});

function recordingSetup() {
  const sentence = { start: 0, end: 2, text: 'record me' };
  let resolveAccess;
  let starts = 0;
  const isRecording = { value: false };
  const currentRecordingSentence = { value: null };
  const isShadowing = { value: true };
  const shadowingMode = { value: true };

  const context = {
    player: {
      loadSessionId: 1,
      isShadowing,
      currentSentence: { value: sentence },
      sound: { value: { playing: () => false, seek() {} } },
    },
    shadowingMode,
    isRecording,
    currentRecordingSentence,
  };

  const recorderContext = vm.createContext({
    ref: value => ({ value }),
    console,
    createVoiceMonitor: () => ({ ready: async () => {}, start() {}, stop() {}, dispose() {} }),
    navigator: {
      mediaDevices: {
        getUserMedia: () => new Promise(resolve => { resolveAccess = resolve; }),
      },
    },
    MediaRecorder: class MockMediaRecorder {
      constructor() { this.state = 'inactive'; }
      start() { starts++; currentRecordingSentence.value = 0; }
      addEventListener() {}
    },
    window: {
      MediaRecorder: class {
        constructor() { this.state = 'inactive'; }
        start() { starts++; currentRecordingSentence.value = 0; }
        addEventListener() {}
      }
    },
    setTimeout: (callback, ms) => {
      if (ms === 500) queueMicrotask(callback);
      return setTimeout(callback, ms);
    },
    clearTimeout,
    performance,
  });

  vm.runInContext(recorderSource, recorderContext);

  const recorder = vm.runInContext(`
    new RecorderManager({
      isShadowingActive: () => context.player.isShadowing.value,
      isShadowingModeActive: () => context.shadowingMode.value,
      getLoadSessionId: () => context.player.loadSessionId,
      getCurrentSentence: () => context.player.currentSentence.value,
      stopPlayback: () => {},
      seekSentence: () => {},
    })
  `, Object.assign(recorderContext, { context }));

  recorder.isRecording = isRecording;

  function trigger() {
    recorder.startSentenceRecording(sentence, {
      lessonName: 'test',
      loadSessionId: context.player.loadSessionId,
      shadowingMode: context.shadowingMode.value,
    });
  }
  trigger();

  return { context, resolveAccess, starts: () => starts, trigger };
}

test('recording starts during the temporary pause caused by HTML5 seeking', async () => {
  const { context, resolveAccess, starts } = recordingSetup();
  resolveAccess(true);
  await new Promise(resolve => setImmediate(resolve));
  await Promise.resolve();
  assert.equal(starts(), 1);
  assert.equal(context.isRecording.value, true);
  assert.equal(context.currentRecordingSentence.value, 0);
});

test('pending recording is cancelled when shadowing ends or lesson changes', async () => {
  for (const cancel of [
    context => { context.player.isShadowing.value = false; },
    context => { context.player.loadSessionId++; },
    context => { context.shadowingMode.value = false; },
  ]) {
    const { context, resolveAccess, starts } = recordingSetup();
    cancel(context);
    resolveAccess(true);
    await new Promise(resolve => setImmediate(resolve));
    await Promise.resolve();
    assert.equal(starts(), 0);
    assert.equal(context.isRecording.value, false);
  }
});
