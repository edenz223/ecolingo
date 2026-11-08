const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const esbuild = require('esbuild');

const source = esbuild.transformSync(
  fs.readFileSync(path.join(__dirname, '../src/utils/practice-status.ts'), 'utf8'),
  { loader: 'ts', format: 'cjs' }
).code;
const scope = { module: { exports: {} } };
vm.runInNewContext(source, scope);
const { derivePracticeStatus, describePracticeStatus, noSpeechMessage } = scope.module.exports;

const base = {
  shadowingMode: true,
  practiceMethod: 'listen',
  zenPhase: 'idle',
  isRecording: false,
  isShadowing: false,
  isPlayingReference: false,
  recordingStatus: '',
  noSpeech: false,
};
const status = overrides => derivePracticeStatus({ ...base, ...overrides });

test('status is hidden while shadowing is off', () => {
  assert.equal(status({ shadowingMode: false, isRecording: true }).visible, false);
  assert.equal(describePracticeStatus(status({ shadowingMode: false })), '');
});

test('listen method moves from reference to shadowing, including microphone warm-up', () => {
  assert.deepEqual([...status({}).steps], ['听原声', '跟读']);
  assert.equal(status({}).activeStep, -1);
  assert.equal(status({ isPlayingReference: true }).activeStep, 0);
  const warmUp = status({ isShadowing: true, recordingStatus: '正在准备麦克风…' });
  assert.equal(warmUp.activeStep, 1);
  assert.equal(warmUp.tone, 'active');
  const speaking = status({ isShadowing: true, isRecording: true, recordingStatus: '请开始跟读…' });
  assert.equal(speaking.tone, 'recording');
  assert.equal(describePracticeStatus(speaking), '跟读：请开始跟读…');
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

test('saving and replay phases explain what is happening', () => {
  assert.equal(status({ practiceMethod: 'replay', zenPhase: 'saving' }).message, '正在保存录音…');
  const preview = status({ practiceMethod: 'replay', zenPhase: 'preview' });
  assert.equal(describePracticeStatus(preview), '回听：正在回听你的录音');
});

test('recorder status text wins over phase defaults', () => {
  const limit = status({ practiceMethod: 'replay', zenPhase: 'saving', recordingStatus: '已达到 10 秒录音上限，正在保存…' });
  assert.equal(limit.message, '已达到 10 秒录音上限，正在保存…');
});

test('no speech shows a retry hint instead of a step', () => {
  const missed = status({ noSpeech: true, isPlayingReference: true });
  assert.equal(missed.message, noSpeechMessage);
  assert.equal(missed.tone, 'warning');
  assert.equal(missed.activeStep, -1);
  assert.equal(describePracticeStatus(missed), noSpeechMessage);
});
