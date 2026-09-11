const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const detectorSource = fs.readFileSync(path.join(root, 'src/utils/voice-activity.js'), 'utf8');
const detectorScope = {};
vm.runInNewContext(detectorSource.replaceAll('export function', 'function'), detectorScope);
const settingsScope = {};
const zenScope = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/utils/zen-flow.js'), 'utf8')
  .replaceAll('export function', 'function'), zenScope);
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/utils/settings.js'), 'utf8')
  .replaceAll('export function', 'function'), settingsScope);

function signal(options) {
  let now = 0;
  const detect = detectorScope.createVoiceActivityDetector(0, options);
  return (rms, duration) => {
    let result;
    for (let i = 0; i < duration; i += 20) result = detect(rms, now += 20);
    return result;
  };
}

test('waits for speech, keeps long speech and breathing pauses, then ends on silence', () => {
  const feed = signal();
  assert.equal(feed(0.001, 2000).reason, null);
  assert.equal(feed(0.08, 6000).reason, null);
  assert.equal(feed(0.001, 800).reason, null);
  assert.equal(feed(0.04, 1000).reason, null);
  assert.equal(feed(0.001, 1180).reason, null);
  assert.equal(feed(0.001, 20).reason, 'silence');
});

test('immediate speech is not calibrated away and quiet speech can finish', () => {
  const feed = signal();
  assert.equal(feed(0.012, 600).state, 'speaking');
  assert.equal(feed(0.001, 1200).reason, 'silence');
});

test('isolated clicks and steady low background noise do not count as speech', () => {
  const feed = signal();
  feed(0.1, 40);
  assert.equal(feed(0.003, 7960).reason, 'no-speech');
});

test('continuous noise/speech has a bounded recording time', () => {
  assert.equal(signal()(0.1, 30000).reason, 'limit');
});

test('brief words count as speech at both trailing silence and a short sentence deadline', () => {
  for (const rms of [0.012, 0.08]) {
    const feed = signal();
    feed(0.001, 300);
    assert.equal(feed(rms, 180).state, 'speaking');
    assert.equal(feed(0.001, 1200).reason, 'silence');

    const short = signal({ maxMs: 300 });
    short(0.001, 60);
    short(rms, 180);
    assert.equal(short(0.001, 60).reason, 'limit');
  }
});

test('separated clicks do not accumulate into a brief word', () => {
  const feed = signal({ maxMs: 1000 });
  for (let i = 0; i < 3; i++) {
    feed(0.1, 40);
    feed(0.001, 260);
  }
  assert.equal(feed(0.001, 100).reason, 'no-speech');
});

test('sentence limits stop short takes and allow long takes beyond 30 seconds', () => {
  for (const maxMs of [1000, 2000, 40000]) {
    const feed = signal({ maxMs });
    assert.equal(feed(0.1, maxMs - 20).reason, null);
    assert.equal(feed(0.1, 20).reason, 'limit');
  }
  assert.equal(signal({ maxMs: 1000 })(0, 1000).reason, 'no-speech');
});

test('a delayed timer does not invent sustained speech', () => {
  const detect = detectorScope.createVoiceActivityDetector(0);
  assert.equal(detect(0.1, 7000).state, 'waiting');
  assert.equal(detect(0, 8000).reason, 'no-speech');
});

const layout = fs.readFileSync(path.join(root, 'src/layouts/MainLayout.vue'), 'utf8')
  .split('<script setup>')[1].split('</script>')[0].replace(/^import .*;\r?\n/gm, '');
const flush = () => new Promise((resolve) => setImmediate(resolve));
function setup({ deferredAccess = false, denied = false, saveFailure = false } = {}) {
  let access;
  let update;
  let readPreview;
  let scrolls = 0;
  const scheduledDelays = [];
  const previews = [];
  const saves = [];
  const tracks = [{ stop() { this.stopped = true; } }];
  const stream = { getTracks: () => tracks };
  class Recorder {
    constructor() {
      this.state = 'inactive';
      this.mimeType = 'audio/webm';
      this.listeners = {};
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    removeEventListener(name) { delete this.listeners[name]; }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      setImmediate(() => {
        this.listeners.dataavailable?.({ data: new Blob(['voice']) });
        this.listeners.stop?.();
      });
    }
  }
  const monitor = {
    ready: async () => {}, start(fn, options) { update = fn; this.options = options; }, stop() {}, dispose() {},
  };
  const context = {
    ref: require('vue').shallowRef, watch: require('vue').watch, onMounted() {}, onUnmounted() {},
    loadSettings: settingsScope.loadSettings, saveSettings: settingsScope.saveSettings,
    createVoiceMonitor: () => monitor,
    createZenCompletion: zenScope.createZenCompletion,
    navigator: { mediaDevices: { getUserMedia: () => denied
      ? Promise.reject(new Error('Permission denied')) : deferredAccess
        ? new Promise((resolve) => { access = resolve; }) : Promise.resolve(stream) } },
    window: { MediaRecorder: Recorder, fileAPI: {
      async saveRecording(meta) {
        if (saveFailure) throw new Error('disk full');
        saves.push(meta);
        return meta;
      },
      readRecording() { return new Promise((resolve) => { readPreview = resolve; }); },
    } },
    Audio: class {
      constructor() { previews.push(this); }
      async play() { this.playing = true; }
      pause() { this.playing = false; }
      removeAttribute() {}
      load() {}
    },
    MediaRecorder: Recorder, Blob, performance, console,
    setTimeout(callback, delay) {
      scheduledDelays.push(delay);
      if (delay === 500) {
        queueMicrotask(callback);
        return -1;
      }
      return setTimeout(callback, delay);
    },
    clearTimeout, URL,
    document: { getElementById: () => ({ scrollIntoView() { scrolls++; } }) },
  };
  vm.createContext(context);
  vm.runInContext(layout + `
    globalThis.h = { player, shadowingMode, isRecording, recordingError, currentPlaybackRate,
      startSentenceRecording, finishShadowing, toggleShadowingMode,
      previewRecording, previewClipId, stopPreview, pauseFollowing, resumeFollowing,
      closeRecordingError, noSpeechSentence, zenMode, zenPhase, zenFirstAttempt, selectPracticeMethod, focusMode,
      toggleZenMode: () => selectPracticeMethod(zenMode.value ? 'listen' : 'attempt'),
      toggleZenFirstAttempt: (value) => selectPracticeMethod(value ? 'attempt' : 'replay'),
      releaseRecordingResources, pendingSaves };
    activeLessonId = 'lesson';
  `, context);
  const { h } = context;
  const sentences = [{ start: 0, end: 1, text: 'one' }, { start: 1, end: 2, text: 'two' }];
  const sound = {
    active: true, at: 1, playing() { return this.active; },
    play() { this.active = true; }, pause() { this.active = false; },
    seek(value) { if (value !== undefined) this.at = value; return this.at; },
    volume() {}, unload() {}, duration: () => 2,
  };
  h.player.sound.value = sound;
  h.player.currentLesson = { name: 'lesson' };
  h.player.currentSentence.value = sentences[0];
  h.player.parsedSentences.value = sentences;
  h.shadowingMode.value = true;
  return { ...h, sound, sentences, saves, tracks, monitor, scheduledDelays,
    previews, scrollCount: () => scrolls,
    finishRead: () => readPreview({ bytes: new Uint8Array([1]), mime: 'audio/webm' }),
    emit: (reason) => update({ state: 'silence', reason }),
    grant: () => access(stream),
    cleanup() { h.closeRecordingError(); h.player.stopCurrentPlayback(); h.releaseRecordingResources(); },
  };
}

test('reference boundary starts independent recording; stop event saves then advances', async () => {
  const h = setup();
  try {
    h.player.step();
    await flush();
    assert.equal(h.sound.playing(), false);
    assert.equal(h.isRecording.value, true);
    h.player.step(true); // Delayed Howler end event cannot finish recording.
    assert.equal(h.isRecording.value, true);
    assert.equal(h.player.currentSentence.value, h.sentences[0]);
    h.emit('silence');
    assert.equal(h.sound.playing(), false); // Wait for MediaRecorder's final data.
    await flush();
    await Promise.all([...h.pendingSaves]);
    assert.equal(h.saves.length, 1);
    assert.equal(h.player.currentSentence.value, h.sentences[1]);
    assert.equal(h.sound.playing(), true);
  } finally { h.cleanup(); }
});

test('manual browsing pauses scroll following without blocking sentence advancement', () => {
  const h = setup();
  try {
    h.pauseFollowing();
    h.player.advanceSentence();
    assert.equal(h.player.currentSentence.value, h.sentences[1]);
    assert.equal(h.scrollCount(), 0);
    h.resumeFollowing();
    assert.equal(h.scrollCount(), 1);
  } finally { h.cleanup(); }
});

test('preview toggles off during loading and playback, and clears after ending', async () => {
  const h = setup();
  try {
    const pending = h.previewRecording({ id: 'take' });
    assert.equal(h.sound.playing(), false);
    await h.previewRecording({ id: 'take' });
    h.finishRead(); await pending;
    assert.equal(h.previews.length, 0);
    assert.equal(h.previewClipId.value, null);
    const playing = h.previewRecording({ id: 'take' });
    h.finishRead(); await playing;
    assert.equal(h.previews[0].playing, true);
    await h.previewRecording({ id: 'take' });
    assert.equal(h.previews[0].playing, false);
    assert.equal(h.previewClipId.value, null);
    const again = h.previewRecording({ id: 'take' });
    h.finishRead(); await again;
    h.previews[1].onended();
    assert.equal(h.previewClipId.value, null);
  } finally { h.cleanup(); }
});

test('recording deadline is always ten seconds', async () => {
  for (const rate of [0.5, 1, 2]) {
    const h = setup();
    try {
      h.currentPlaybackRate.value = rate;
      h.player.step(); await flush();
      assert.ok(h.scheduledDelays.includes(500));
      assert.equal(h.monitor.options.maxMs, 10000);
      h.emit('limit');
      assert.equal(h.sound.playing(), false);
      await flush();
      await Promise.all([...h.pendingSaves]);
      assert.equal(h.saves.length, 1);
      assert.equal(h.player.currentSentence.value, h.sentences[1]);
    } finally { h.cleanup(); }
  }
});

test('manual completion repeats current sentence and final sentence ends cleanly', async () => {
  const h = setup();
  try {
    h.player.repeatOne.value = true;
    h.player.step(); await flush();
    h.finishShadowing(); await flush();
    assert.equal(h.sound.at, 0);
    assert.equal(h.sound.playing(), true);
    h.player.repeatOne.value = false;
    h.player.currentSentence.value = h.sentences[1];
    h.sound.at = 2;
    h.player.step(true); await flush();
    h.emit('silence'); await flush();
    assert.equal(h.sound.playing(), false);
    assert.equal(h.player.isShadowing.value, false);
  } finally { h.cleanup(); }
});

test('no speech pauses at current sentence without saving an empty take', async () => {
  const h = setup();
  try {
    h.player.step(); await flush(); h.emit('no-speech'); await flush();
    assert.equal(h.sound.playing(), false);
    assert.equal(h.sound.at, 0);
    assert.equal(h.saves.length, 0);
    assert.equal(h.recordingError.value, '');
    assert.equal(h.noSpeechSentence.value, h.sentences[0].start);
  } finally { h.cleanup(); }
});

test('no-speech icon clears after one second without a popup or resuming playback', async () => {
  const h = setup();
  const newer = setup();
  try {
    h.player.step(); newer.player.step(); await flush();
    h.emit('no-speech'); newer.emit('no-speech'); await flush();
    assert.equal(h.recordingError.value, '');
    assert.equal(h.noSpeechSentence.value, h.sentences[0].start);
    newer.recordingError.value = '麦克风已断开';
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(h.recordingError.value, '');
    assert.equal(h.sound.playing(), false);
    assert.equal(h.saves.length, 0);
    assert.equal(h.noSpeechSentence.value, null);
    assert.equal(newer.recordingError.value, '麦克风已断开');
  } finally { h.cleanup(); newer.cleanup(); }
});

test('pause after detector completion cancels queued advance and discards the take', async () => {
  const h = setup();
  try {
    h.player.step(); await flush(); h.emit('silence');
    h.player.togglePlay(); await flush();
    assert.equal(h.sound.playing(), false);
    assert.equal(h.saves.length, 0);
    assert.equal(h.player.currentSentence.value, h.sentences[0]);
  } finally { h.cleanup(); }
});

test('late microphone permission after lesson release stops tracks and cannot record', async () => {
  const h = setup({ deferredAccess: true });
  try {
    h.player.step();
    h.player.releaseLesson();
    h.grant(); await flush();
    assert.equal(h.tracks[0].stopped, true);
    assert.equal(h.isRecording.value, false);
    assert.equal(h.saves.length, 0);
  } finally { h.cleanup(); }
});

test('permission denial leaves the current sentence paused and retryable', async () => {
  const h = setup({ denied: true });
  try {
    h.player.step(); await flush();
    assert.equal(h.player.isShadowing.value, false);
    assert.equal(h.isRecording.value, false);
    assert.equal(h.sound.at, 0);
    assert.match(h.recordingError.value, /Permission denied/);
  } finally { h.cleanup(); }
});

test('disabling shadowing during recording cancels monitoring and releases the mic', async () => {
  const h = setup();
  try {
    h.player.step(); await flush();
    await h.toggleShadowingMode();
    h.emit('silence'); await flush(); // A stale callback must be harmless.
    assert.equal(h.tracks[0].stopped, true);
    assert.equal(h.isRecording.value, false);
    assert.equal(h.sound.playing(), false);
    assert.equal(h.sound.at, 0);
    assert.equal(h.saves.length, 0);
  } finally { h.cleanup(); }
});

test('sentence navigation cancels a take and prevents its stop event from advancing', async () => {
  const h = setup();
  try {
    h.player.step(); await flush();
    await h.player.clickSentence(h.sentences[1]);
    h.emit('silence'); await flush();
    assert.equal(h.player.currentSentence.value, h.sentences[1]);
    assert.equal(h.sound.at, 1);
    assert.equal(h.sound.playing(), true);
    assert.equal(h.saves.length, 0);
  } finally { h.cleanup(); }
});

test('Zen discards first take, saves second, replays and advances only on playback end', async () => {
  const h = setup();
  try {
    h.toggleZenMode();
    assert.equal(h.isRecording.value, false);
    assert.equal(h.sound.playing(), false);
    h.player.togglePlay();
    await flush();
    assert.equal(h.zenPhase.value, 'first');
    h.emit('silence');
    assert.equal(h.sound.playing(), false);
    await flush();
    assert.equal(h.saves.length, 0);
    assert.equal(h.zenPhase.value, 'reference');
    h.sound.seek(1);
    h.player.step();
    await flush();
    assert.equal(h.zenPhase.value, 'second');
    h.emit('silence');
    await flush();
    await Promise.all([...h.pendingSaves]);
    await flush();
    assert.equal(h.saves.length, 1);
    assert.equal(h.zenPhase.value, 'preview');
    assert.equal(h.player.currentSentence.value, h.sentences[0]);
    h.finishRead();
    await flush();
    assert.equal(h.previews[0].playing, true);
    h.previews[0].onended();
    await flush();
    assert.equal(h.player.currentSentence.value, h.sentences[1]);
    assert.equal(h.zenPhase.value, 'first');
  } finally { h.cleanup(); }
});

test('Zen cancellation during permission request cannot restart practice', async () => {
  const h = setup({ deferredAccess: true });
  try {
    h.toggleZenMode();
    h.player.togglePlay();
    h.player.togglePlay();
    h.grant();
    await flush();
    assert.equal(h.zenPhase.value, 'idle');
    assert.equal(h.isRecording.value, false);
    assert.equal(h.tracks[0].stopped, true);
    assert.equal(h.saves.length, 0);
  } finally { h.cleanup(); }
});

test('Zen no speech pauses without saving; navigation and exit stay paused', async () => {
  const h = setup();
  try {
    h.toggleZenMode();
    h.player.togglePlay();
    await flush();
    h.emit('no-speech');
    await flush();
    assert.equal(h.zenPhase.value, 'idle');
    assert.equal(h.saves.length, 0);
    assert.equal(h.noSpeechSentence.value, 0);
    h.player.clickSentence(h.sentences[1]);
    assert.equal(h.noSpeechSentence.value, null);
    assert.equal(h.sound.playing(), false);
    h.toggleZenMode();
    assert.equal(h.shadowingMode.value, true);
    assert.equal(h.sound.playing(), false);
  } finally { h.cleanup(); }
});

async function reachZenPreview(h) {
  h.toggleZenMode();
  h.player.togglePlay();
  await flush();
  h.emit('silence');
  await flush();
  h.sound.seek(h.player.currentSentence.value.end);
  h.player.step(true);
  await flush();
  h.emit('silence');
  await flush();
  await Promise.all([...h.pendingSaves]);
  await flush();
}

test('Zen repeats the complete cycle and stops after the final sentence replay', async () => {
  for (const repeat of [true, false]) {
    const h = setup();
    try {
      h.player.currentSentence.value = h.sentences[1];
      h.player.repeatOne.value = repeat;
      await reachZenPreview(h);
      h.finishRead();
      await flush();
      h.previews[0].onended();
      await flush();
      assert.equal(h.zenPhase.value, repeat ? 'first' : 'idle');
      assert.equal(h.player.currentSentence.value, h.sentences[1]);
      assert.equal(h.saves.length, 1);
      assert.equal(h.sound.playing(), false);
    } finally { h.cleanup(); }
  }
});

test('Zen stops pending replay and ignores its stale loaded audio after navigation', async () => {
  const h = setup();
  try {
    await reachZenPreview(h);
    h.player.clickSentence(h.sentences[1]);
    h.finishRead();
    await flush();
    assert.equal(h.previews.length, 0);
    assert.equal(h.zenPhase.value, 'idle');
    assert.equal(h.saves.length, 1);
  } finally { h.cleanup(); }
});

test('Zen playback failure pauses and preserves the saved second take', async () => {
  const h = setup();
  try {
    await reachZenPreview(h);
    h.finishRead();
    await flush();
    h.previews[0].onerror();
    assert.equal(h.zenPhase.value, 'idle');
    assert.equal(h.saves.length, 1);
    assert.ok(h.recordingError.value);
  } finally { h.cleanup(); }
});

test('Zen save failure pauses before replay and never advances', async () => {
  const h = setup({ saveFailure: true });
  try {
    h.toggleZenMode();
    h.player.togglePlay();
    await flush();
    h.emit('silence');
    await flush();
    h.sound.seek(1);
    h.player.step();
    await flush();
    h.emit('silence');
    await flush();
    await flush();
    assert.equal(h.zenPhase.value, 'idle');
    assert.match(h.recordingError.value, /disk full/);
    assert.equal(h.previews.length, 0);
    assert.equal(h.player.currentSentence.value, h.sentences[0]);
  } finally { h.cleanup(); }
});

test('Zen optional first attempt skips straight to reference and still saves and replays', async () => {
  const h = setup();
  try {
    h.toggleZenMode();
    h.toggleZenFirstAttempt(false);
    h.player.togglePlay();
    assert.equal(h.zenPhase.value, 'reference');
    assert.equal(h.isRecording.value, false);
    assert.equal(h.sound.playing(), true);
    h.sound.seek(1);
    h.player.step();
    await flush();
    assert.equal(h.zenPhase.value, 'second');
    h.emit('silence');
    await flush();
    await flush();
    assert.equal(h.saves.length, 1);
    h.finishRead();
    await flush();
    h.previews[0].onended();
    assert.equal(h.player.currentSentence.value, h.sentences[1]);
    assert.equal(h.zenPhase.value, 'reference');
    assert.equal(h.isRecording.value, false);
  } finally { h.cleanup(); }
});

test('changing first attempt cancels an active take and applies on next start', async () => {
  const h = setup();
  try {
    h.toggleZenMode();
    h.player.togglePlay();
    await flush();
    assert.equal(h.isRecording.value, true);
    h.toggleZenFirstAttempt(false);
    await flush();
    assert.equal(h.zenPhase.value, 'idle');
    assert.equal(h.isRecording.value, false);
    assert.equal(h.saves.length, 0);
    h.player.togglePlay();
    assert.equal(h.zenPhase.value, 'reference');
    h.toggleZenFirstAttempt(true);
    assert.equal(h.sound.playing(), false);
    h.player.togglePlay();
    await flush();
    assert.equal(h.zenPhase.value, 'first');
  } finally { h.cleanup(); }
});

test('shadowing is the parent switch: enabling needs no microphone and disabling exits Zen', async () => {
  const h = setup({ denied: true });
  try {
    h.shadowingMode.value = false;
    h.toggleShadowingMode();
    assert.equal(h.shadowingMode.value, true);
    assert.equal(h.zenMode.value, false);
    assert.equal(h.recordingError.value, '');
    h.toggleZenMode();
    assert.equal(h.zenMode.value, true);
    h.toggleShadowingMode();
    assert.equal(h.shadowingMode.value, false);
    assert.equal(h.zenMode.value, false);
    assert.equal(h.sound.playing(), false);
    h.toggleZenMode();
    assert.equal(h.zenMode.value, false);
  } finally { h.cleanup(); }
});

test('practice selection is independent from focus layout and survives the master switch', () => {
  const h = setup();
  try {
    h.selectPracticeMethod('replay');
    assert.equal(h.zenMode.value, true);
    assert.equal(h.focusMode.value, false);
    assert.equal(h.zenFirstAttempt.value, false);
    h.focusMode.value = true;
    h.toggleShadowingMode();
    assert.equal(h.focusMode.value, true);
    h.toggleShadowingMode();
    assert.equal(h.zenMode.value, true);
    h.selectPracticeMethod('listen');
    assert.equal(h.zenMode.value, false);
    assert.equal(h.focusMode.value, true);
    assert.equal(h.sound.seek(), h.sentences[0].start);
  } finally { h.cleanup(); }
});
