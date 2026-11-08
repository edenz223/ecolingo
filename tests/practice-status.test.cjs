const assert = require('node:assert/strict');
const test = require('node:test');
const { loadTs } = require('./helpers/load-ts.cjs');

const { derivePracticeStatus, noSpeechMessage } = loadTs('src/utils/practice-status.ts');

const base = {
  shadowingMode: true,
  practiceMethod: 'listen',
  zenPhase: 'idle',
  comparePhase: 'idle',
  isRecording: false,
  isShadowing: false,
  isPlayingReference: false,
  noSpeech: false,
};
const status = overrides => derivePracticeStatus({ ...base, ...overrides });

test('status is hidden while shadowing is off', () => {
  assert.equal(status({ shadowingMode: false, isRecording: true }).visible, false);
});

test('listen method moves from reference to shadowing, including microphone warm-up', () => {
  assert.deepEqual([...status({}).steps], ['听原声', '跟读']);
  assert.equal(status({}).activeStep, -1);
  assert.equal(status({ isPlayingReference: true }).activeStep, 0);
  const warmUp = status({ isShadowing: true });
  assert.equal(warmUp.activeStep, 1);
  assert.equal(warmUp.tone, 'active');
  const speaking = status({ isShadowing: true, isRecording: true });
  assert.equal(speaking.tone, 'recording');
  assert.equal(speaking.message, '');
});

test('Zen phases map onto replay and attempt steps', () => {
  const replay = phase => status({ practiceMethod: 'replay', zenPhase: phase }).activeStep;
  assert.deepEqual(['idle', 'reference', 'second', 'saving', 'preview'].map(replay), [-1, 0, 1, 1, 2]);
  const attempt = phase => status({ practiceMethod: 'attempt', zenPhase: phase }).activeStep;
  assert.deepEqual(
    ['idle', 'first', 'reference', 'second', 'saving', 'preview'].map(attempt),
    [-1, 0, 1, 2, 2, 3]
  );
  assert.deepEqual([...status({ practiceMethod: 'attempt' }).steps], ['尝试', '听原声', '跟读', '回听']);
});

test('only warnings carry text; steps alone show saving and replay', () => {
  const saving = status({ practiceMethod: 'replay', zenPhase: 'saving' });
  assert.equal(saving.message, '');
  assert.equal(saving.tone, 'active');
  assert.equal(status({ practiceMethod: 'replay', zenPhase: 'preview' }).message, '');
});

test('A/B comparison shows its own steps even with shadowing off', () => {
  const compare = phase => status({ shadowingMode: false, comparePhase: phase });
  assert.deepEqual([...compare('original').steps], ['原声', '我的录音']);
  assert.deepEqual(['original', 'gap', 'recording'].map(phase => compare(phase).activeStep), [0, 1, 1]);
  assert.equal(compare('recording').visible, true);
  const duringZen = status({ practiceMethod: 'attempt', zenPhase: 'reference', comparePhase: 'gap' });
  assert.deepEqual([...duringZen.steps], ['原声', '我的录音']);
});

test('no speech shows a retry hint instead of a step', () => {
  const missed = status({ noSpeech: true, isPlayingReference: true });
  assert.equal(missed.message, noSpeechMessage);
  assert.equal(missed.tone, 'warning');
  assert.equal(missed.activeStep, -1);
});
