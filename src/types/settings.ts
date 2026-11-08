export type LoopMode = 'off' | 'list' | 'one';

export type PracticeMethod = 'listen' | 'replay' | 'attempt';

export type ThemePreference = 'system' | 'light' | 'dark';

export type SubtitleSize = 'small' | 'medium' | 'large';

// Where the learner last was, so the empty screen can offer to continue.
export interface ResumePoint {
  lessonKey: string;
  sentenceStart: number;
  sentenceIndex: number;
}

export interface UserSettings {
  playbackRate: number;
  shadowing: boolean;
  loopMode: LoopMode;
  repeatCount: number;
  drawerOpen: boolean;
  zenFirstAttempt: boolean;
  practiceMethod: PracticeMethod;
  resume: ResumePoint | null;
  theme: ThemePreference;
  subtitleSize: SubtitleSize;
}
