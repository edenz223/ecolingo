const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync('src/layouts/MainLayout.vue', 'utf8');
const playerSource = source.slice(source.indexOf('class Player {'), source.indexOf('const player = new Player();'));

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
  const player = vm.runInContext(`${playerSource}\nnew Player()`, context);
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
  const a = player.playLesson(lesson('A')); resolve('A'); await a;
  const b = player.playLesson(lesson('B'));
  assert.equal(sounds[0].unloaded, true);
  resolve('B'); await b;
  sounds[1].options.onload();
  sounds[0].options.onload();
  sounds[0].options.onloaderror(0, 'stale failure');
  assert.equal(player.sound.value, sounds[1]);
  assert.equal(player.parsedSentences.value[0].text, 'B');
  assert.equal(sounds[1].unloaded, false);
});

test('switching releases active audio and stale animation callbacks', async () => {
  const { player, sounds, frames, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A')); resolve('A'); await a;
  sounds[0].options.onload();
  const oldFrame = [...frames.values()][0];
  const b = player.playLesson(lesson('B'));
  assert.equal(sounds[0].unloaded, true);
  assert.equal(frames.size, 0);
  assert.equal(player.sound.value, null);
  oldFrame();
  resolve('B'); await b;
  sounds[1].options.onloaderror(0, 'load failed');
  assert.equal(sounds[1].unloaded, true);
  assert.equal(player.sound.value, null);
});

test('teardown invalidates a pending transcript', async () => {
  const { player, sounds, lesson, resolve } = setup();
  const a = player.playLesson(lesson('A'));
  player.releaseLesson();
  resolve('A'); await a;
  assert.equal(sounds.length, 0);
  assert.equal(player.currentLesson, null);
});

test('audio end starts the final shadow interval and then stops cleanly', async () => {
  const { player, sounds, lesson, resolve, shadowingMode, recordingEvents } = setup();
  const loading = player.playLesson(lesson('A')); resolve('A'); await loading;
  sounds[0].options.onload();
  shadowingMode.value = true;
  sounds[0].active = false;
  sounds[0].options.onend();
  assert.equal(player.isShadowing.value, true);
  assert.equal(sounds[0].playing(), true);
  assert.deepEqual(recordingEvents.at(-1), ['start', 'A']);
  sounds[0].active = false;
  sounds[0].options.onend();
  assert.equal(player.isShadowing.value, false);
  assert.equal(sounds[0].playing(), false);
  assert.deepEqual(recordingEvents.at(-1), ['stop']);
});

test('timer advances listen-shadow-listen even while transcript is scrolling', async () => {
  const { player, sounds, frames, lesson, resolve, shadowingMode } = setup();
  const loading = player.playLesson(lesson('A')); resolve('A'); await loading;
  sounds[0].options.onload();
  player.parsedSentences.value[0].end = 2;
  const second = { start: 2, end: 10, text: 'second' };
  player.parsedSentences.value.push(second);
  shadowingMode.value = true;
  player.isScrolling.value = true;
  sounds[0].position = 2.1;
  [...frames.values()].at(-1)();
  assert.equal(player.isShadowing.value, true);
  assert.equal(sounds[0].position, 0);
  sounds[0].position = 2.1;
  [...frames.values()].at(-1)();
  assert.equal(player.isShadowing.value, false);
  assert.equal(player.currentSentence.value, second);
  assert.equal(sounds[0].position, 2);
});

test('repeat-one restarts after final shadow interval', async () => {
  const { player, sounds, lesson, resolve, shadowingMode } = setup();
  const loading = player.playLesson(lesson('A')); resolve('A'); await loading;
  sounds[0].options.onload();
  shadowingMode.value = true;
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
  const context = vm.createContext({
    player: {
      loadSessionId: 1,
      isShadowing: { value: true },
      currentSentence: { value: sentence },
      sound: { value: { playing: () => false } },
    },
    shadowingMode: { value: true },
    ensureRecorderAccess: () => new Promise(resolve => { resolveAccess = resolve; }),
    mediaRecorder: { state: 'inactive', start() { starts++; } },
    isRecording: { value: false }, currentRecordingSentence: { value: null },
    pendingRecordingSentence: null, recordingChunks: [], recordingTimeoutId: null,
  });
  const start = source.indexOf('function startSentenceRecording(sentence)');
  const end = source.indexOf('function stopSentenceRecording(', start);
  vm.runInContext(source.slice(start, end), context);
  context.startSentenceRecording(sentence);
  return { context, resolveAccess, starts: () => starts };
}

test('recording starts during the temporary pause caused by HTML5 seeking', async () => {
  const { context, resolveAccess, starts } = recordingSetup();
  resolveAccess(true);
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
    await Promise.resolve();
    assert.equal(starts(), 0);
    assert.equal(context.isRecording.value, false);
  }
});
