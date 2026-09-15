export interface VADOptions {
  silenceMs?: number;
  speechMs?: number;
  waitMs?: number;
  maxMs?: number;
}

export type VADReason = 'no-speech' | 'silence' | 'limit' | null;

export type VADState = 'waiting' | 'speaking' | 'silence';

export interface VADResult {
  reason: VADReason;
  voiceActive: boolean;
  state: VADState;
}

export type VoiceActivityDetector = (rms: number, now: number) => VADResult;

export interface VoiceMonitor {
  ready(): Promise<void>;
  start(onUpdate: (result: VADResult) => void, options?: VADOptions): void;
  stop(): void;
  dispose(): void;
}
