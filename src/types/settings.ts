export type PracticeMethod = 'listen' | 'replay' | 'attempt';

export interface UserSettings {
  playbackRate: number;
  shadowing: boolean;
  repeatOne: boolean;
  drawerOpen: boolean;
  zenFirstAttempt: boolean;
  practiceMethod: PracticeMethod;
}
