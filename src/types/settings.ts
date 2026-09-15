export type LoopMode = 'off' | 'list' | 'one';

export type PracticeMethod = 'listen' | 'replay' | 'attempt';

export interface UserSettings {
  playbackRate: number;
  shadowing: boolean;
  loopMode: LoopMode;
  repeatCount: number;
  drawerOpen: boolean;
  zenFirstAttempt: boolean;
  practiceMethod: PracticeMethod;
}
