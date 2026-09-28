const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const esbuild = require('esbuild');

function load(file, dependencies = {}, globals = {}) {
  const source = esbuild.transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    loader: 'ts',
    format: 'cjs',
  }).code;
  const scope = { module: { exports: {} }, require: name => dependencies[name], ...globals };
  vm.runInNewContext(source, scope);
  return scope.module.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

async function setup(zenPhase = null) {
  const timers = [];
  const cues = [];
  const saves = [];
  const completions = [];
  let advances = 0;
  const sentence = { start: 1, end: 3, text: 'Try again' };
  const state = { sentence, session: 1, active: true };
  class MediaRecorder extends EventTarget {
    state = 'inactive';
    mimeType = 'audio/webm';
    starts = 0;
    start() {
      this.state = 'recording';
      this.starts++;
    }
    stop() {
      this.state = 'inactive';
    }
    finish() {
      const data = new Event('dataavailable');
      data.data = new Blob(['discarded attempt']);
      this.dispatchEvent(data);
      this.dispatchEvent(new Event('stop'));
    }
  }
  const monitor = { ready: async () => {}, start() {}, stop() {}, dispose() {} };
  const { RecorderManager } = load(
    'src/modules/recorder.ts',
    {
      vue: { ref: value => ({ value }) },
      '../utils/voice-activity': { createVoiceMonitor: () => monitor },
      '../utils/recording-cue': {
        playRecordingRestartCue() {
          let resolve;
          const finished = new Promise(done => {
            resolve = done;
          });
          const cue = {
            finished,
            cancel: () => {
              cue.cancelled = true;
              resolve();
            },
            end: () => resolve(),
          };
          cues.push(cue);
          return cue;
        },
      },
    },
    {
      window: { MediaRecorder },
      MediaRecorder,
      Blob,
      performance,
      navigator: {
        mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) },
      },
      setTimeout: callback => {
        timers.push(callback);
        return timers.length;
      },
      clearTimeout() {},
    }
  );
  const recorder = new RecorderManager({
    isShadowingActive: () => state.active,
    isShadowingModeActive: () => true,
    getLoadSessionId: () => state.session,
    getCurrentSentence: () => state.sentence,
    onRecordingComplete: (...args) => completions.push(args),
    advanceSentence: () => advances++,
  });
  recorder.saveRecording = (...args) => {
    saves.push(args);
    return Promise.resolve({});
  };
  await recorder.ensureRecorderAccess();
  const media = recorder.mediaRecorder;
  const options = {
    lessonName: 'Lesson',
    loadSessionId: 1,
    shadowingMode: true,
    zenMode: Boolean(zenPhase),
    zenPhase,
    zenSession: 7,
  };
  const flush = async () => {
    while (timers.length) timers.shift()();
    await tick();
  };
  recorder.startSentenceRecording(sentence, options);
  await tick();
  await flush();
  assert.equal(media.starts, 1);
  return { recorder, media, cues, state, saves, completions, advances: () => advances, flush };
}

for (const phase of [null, 'first', 'second']) {
  test(`restart discards the old take and preserves phase ${phase}`, async () => {
    const h = await setup(phase);
    const pending = h.recorder.restartSentenceRecording();
    assert.equal(h.recorder.isPreparingRecording.value, true);
    assert.equal(h.recorder.recordingRevision.value, 1);
    await h.recorder.restartSentenceRecording(); // Repeated R while stop is pending.
    assert.equal(h.cues.length, 0);
    assert.equal(h.media.starts, 1);
    h.media.finish();
    await tick();
    assert.equal(h.cues.length, 1);
    assert.equal(h.saves.length + h.completions.length + h.advances(), 0);
    assert.equal(h.recorder.recordingChunks.length, 0);
    assert.equal(h.media.starts, 1); // No recording during the cue.
    assert.equal(h.recorder.isRecording.value || h.recorder.isPreparingRecording.value, true);
    h.cues[0].end();
    await pending;
    await tick();
    assert.equal(h.recorder.isRecording.value || h.recorder.isPreparingRecording.value, true);
    await h.flush();
    assert.equal(h.media.starts, 2);
    assert.equal(h.recorder.isRecording.value, true);
    assert.equal(h.recorder.isPreparingRecording.value, false);
    assert.equal(h.recorder.activeRecordingRequest.options.zenPhase, phase);
    assert.equal(h.recorder.activeRecordingRequest.options.zenSession, 7);
    h.recorder.finishShadowing('silence', {
      sentence: h.state.sentence,
      sessionId: 1,
      zenSession: 7,
      zenPhase: phase,
    });
    h.media.finish();
    assert.equal(phase ? h.completions.length : h.saves.length, 1);
    assert.equal(h.advances(), phase ? 0 : 1);
  });
}

test('pause while stop is pending cancels the restart', async () => {
  const h = await setup();
  const pending = h.recorder.restartSentenceRecording();
  h.recorder.stopSentenceRecording(true);
  h.media.finish();
  await pending;
  assert.equal(h.cues.length, 0);
  assert.equal(h.media.starts, 1);
});

test('pause or release during the cue cancels it and never restarts', async () => {
  for (const cancel of [
    h => h.recorder.stopSentenceRecording(true),
    h => h.recorder.releaseRecordingResources(),
  ]) {
    const h = await setup('second');
    const pending = h.recorder.restartSentenceRecording();
    h.media.finish();
    await tick();
    cancel(h);
    await pending;
    await h.flush();
    assert.equal(h.cues[0].cancelled, true);
    assert.equal(h.recorder.isPreparingRecording.value, false);
    assert.equal(h.media.starts, 1);
  }
});

test('navigation and lesson changes invalidate pending restarts', async () => {
  for (const change of [
    h => h.state.session++,
    h => {
      h.state.sentence = { start: 4 };
    },
    h => {
      h.state.active = false;
    },
  ]) {
    const h = await setup();
    const pending = h.recorder.restartSentenceRecording();
    h.media.finish();
    await tick();
    change(h);
    h.cues[0].end();
    await pending;
    await h.flush();
    assert.equal(h.media.starts, 1);
  }
});

test('pause during the post-cue delay cancels the microphone start', async () => {
  const h = await setup();
  const pending = h.recorder.restartSentenceRecording();
  h.media.finish();
  await tick();
  h.cues[0].end();
  await pending;
  await tick();
  h.recorder.stopSentenceRecording(true);
  await h.flush();
  assert.equal(h.media.starts, 1);
});

test('late events from a released recorder cannot overwrite a new recording', async () => {
  const h = await setup();
  const pending = h.recorder.restartSentenceRecording();
  h.recorder.releaseRecordingResources();
  await h.recorder.ensureRecorderAccess();
  h.recorder.startSentenceRecording(h.state.sentence, {
    lessonName: 'Lesson',
    loadSessionId: 1,
    shadowingMode: true,
  });
  await tick();
  await h.flush();
  h.media.finish();
  await pending;
  assert.equal(h.recorder.isRecording.value, true);
  assert.equal(h.recorder.mediaRecorder.state, 'recording');
  assert.equal(h.recorder.recordingChunks.length, 0);
  assert.equal(h.cues.length, 0);
});

test('the local cue completes and releases audio resources after the tone ends', async () => {
  let oscillator;
  let closed = 0;
  const { playRecordingRestartCue } = load(
    'src/utils/recording-cue.ts',
    {},
    {
      AudioContext: class {
        currentTime = 0;
        resume() {
          return Promise.resolve();
        }
        close() {
          closed++;
          return Promise.resolve();
        }
        createGain() {
          return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
        }
        createOscillator() {
          oscillator = {
            frequency: { setValueAtTime() {} },
            connect() {},
            disconnect() {},
            start() {},
            stop(time) {
              assert.equal(time, 0.2);
            },
          };
          return oscillator;
        }
      },
    }
  );
  const cue = playRecordingRestartCue();
  let finished = false;
  void cue.finished.then(() => {
    finished = true;
  });
  await tick();
  assert.equal(finished, false);
  oscillator.onended();
  await cue.finished;
  assert.equal(finished, true);
  assert.equal(closed, 1);
  cue.cancel();
  assert.equal(closed, 1);
});

for (const method of ['listen', 'replay', 'attempt']) {
  test(`R skips playing audio and records the current sentence in ${method} mode`, async () => {
    const h = await setup();
    h.recorder.stopSentenceRecording(true);
    h.media.finish();
    const cleared = [];
    const { ZenCoordinator } = load(
      'src/modules/zen.ts',
      {
        vue: { ref: value => ({ value }) },
        '../utils/zen-flow': { createZenCompletion: () => () => {} },
      },
      { clearTimeout: id => cleared.push(id) }
    );
    let playing = true;
    const player = {
      currentSentence: { value: h.state.sentence },
      currentLesson: { name: 'Lesson' },
      loadSessionId: 1,
      sound: {
        value: {
          playing: () => playing,
          pause: () => {
            playing = false;
          },
        },
      },
      isShadowing: { value: false },
      stepTimerId: 11,
      currentPause: 12,
    };
    const shadowing = { value: false };
    const zen = new ZenCoordinator(player, h.recorder, shadowing, method);
    zen.recordCurrentSentence();
    assert.equal(playing, false);
    assert.equal(shadowing.value, true);
    assert.equal(player.isShadowing.value, true);
    assert.deepEqual(cleared, [11, 12]);
    assert.equal(player.stepTimerId, null);
    assert.equal(player.currentPause, null);
    assert.equal(h.recorder.isPreparingRecording.value, true);
    assert.equal(h.cues.length, 1);
    zen.recordCurrentSentence(); // Ignore extra presses during the transition.
    assert.equal(h.cues.length, 1);
    h.cues[0].end();
    await tick();
    await h.flush();
    assert.equal(h.media.starts, 2);
    const request = h.recorder.activeRecordingRequest;
    assert.equal(request.sentence, h.state.sentence);
    assert.equal(request.options.zenMode, method !== 'listen');
    assert.equal(request.options.zenPhase, method === 'listen' ? 'idle' : 'second');
    assert.equal(h.saves.length + h.completions.length + h.advances(), 0);
  });
}

test('R works on focused buttons, ignores repeats, input, modifiers and idle state', () => {
  const { createRecordingRestartShortcut } = load('src/utils/recording-shortcut.ts');
  let restarts = 0;
  let recording = true;
  let blocked = false;
  const handler = createRecordingRestartShortcut({
    canRecord: () => recording,
    isBlocked: () => blocked,
    restart: () => restarts++,
  });
  const event = overrides => ({
    code: 'KeyR',
    target: { closest: () => null },
    preventDefault() {},
    stopImmediatePropagation() {},
    ...overrides,
  });
  handler(event());
  assert.equal(restarts, 1);
  for (const override of [
    { repeat: true },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { isComposing: true },
    { target: { closest: () => ({}) } },
  ])
    handler(event(override));
  recording = false;
  handler(event());
  recording = true;
  blocked = true;
  handler(event());
  assert.equal(restarts, 1);
});
