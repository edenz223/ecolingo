import type { PracticeMethod } from '../types/settings';
import type { ComparePhase } from '../modules/compare';

export type ZenPhase = 'idle' | 'first' | 'reference' | 'second' | 'saving' | 'preview';
export type PracticeTone = 'idle' | 'active' | 'recording' | 'warning';

export interface PracticeStatusInput {
  shadowingMode: boolean;
  practiceMethod: PracticeMethod;
  zenPhase: ZenPhase;
  comparePhase: ComparePhase;
  isRecording: boolean;
  // Playback is paused so the learner can speak, including microphone warm-up.
  isShadowing: boolean;
  isPlayingReference: boolean;
  recordingStatus: string;
  noSpeech: boolean;
}

export interface PracticeStatus {
  visible: boolean;
  steps: readonly string[];
  // Index into steps, or -1 while waiting for the user to start.
  activeStep: number;
  message: string;
  tone: PracticeTone;
}

export const noSpeechMessage = '没听到声音，按空格重试';

const compareSteps = ['原声', '我的录音'] as const;

const practiceSteps: Record<PracticeMethod, readonly string[]> = {
  listen: ['听原声', '跟读'],
  replay: ['听原声', '跟读', '回听'],
  attempt: ['尝试', '听原声', '跟读', '回听'],
};

// Zen phases map onto the visible steps of the method that produced them.
const zenStepIndex: Record<'replay' | 'attempt', Partial<Record<ZenPhase, number>>> = {
  replay: { reference: 0, second: 1, saving: 1, preview: 2 },
  attempt: { first: 0, reference: 1, second: 2, saving: 2, preview: 3 },
};

const phaseMessages: Partial<Record<ZenPhase, string>> = {
  saving: '正在保存录音…',
  preview: '正在回听你的录音',
};

function activeStepFor(input: PracticeStatusInput): number {
  if (input.practiceMethod === 'listen') {
    if (input.isRecording || input.isShadowing) return 1;
    return input.isPlayingReference ? 0 : -1;
  }
  return zenStepIndex[input.practiceMethod][input.zenPhase] ?? -1;
}

export function derivePracticeStatus(input: PracticeStatusInput): PracticeStatus {
  // An A/B comparison is shown whether or not shadowing is on.
  if (input.comparePhase !== 'idle') {
    const activeStep = input.comparePhase === 'original' ? 0 : 1;
    return { visible: true, steps: compareSteps, activeStep, message: '', tone: 'active' };
  }
  const steps = practiceSteps[input.practiceMethod];
  if (!input.shadowingMode) {
    return { visible: false, steps, activeStep: -1, message: '', tone: 'idle' };
  }
  if (input.noSpeech) {
    return { visible: true, steps, activeStep: -1, message: noSpeechMessage, tone: 'warning' };
  }
  const activeStep = activeStepFor(input);
  const message = input.recordingStatus || phaseMessages[input.zenPhase] || '';
  const tone: PracticeTone = input.isRecording
    ? 'recording'
    : activeStep >= 0 || message
    ? 'active'
    : 'idle';
  return { visible: true, steps, activeStep, message, tone };
}
