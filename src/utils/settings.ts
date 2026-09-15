import type { UserSettings, PracticeMethod, LoopMode } from '../types/settings';

const defaults: UserSettings = {
  playbackRate: 1,
  shadowing: false,
  loopMode: 'off',
  repeatCount: 1,
  drawerOpen: true,
  zenFirstAttempt: true,
  practiceMethod: 'listen',
};
const storageKey = 'ecolingo.settings.v1';

export function normalizeSettings(value: unknown): UserSettings {
  const settings: UserSettings = { ...defaults };
  if (!value || typeof value !== 'object') return settings;
  const obj = value as Record<string, unknown>;
  if (['listen', 'replay', 'attempt'].includes(obj.practiceMethod as string)) {
    settings.practiceMethod = obj.practiceMethod as PracticeMethod;
  }
  for (const key of ['shadowing', 'drawerOpen', 'zenFirstAttempt'] as const) {
    if (typeof obj[key] === 'boolean') {
      settings[key] = obj[key] as boolean;
    }
  }
  if (['off', 'list', 'one'].includes(obj.loopMode as string)) {
    settings.loopMode = obj.loopMode as LoopMode;
  } else if (obj.loopMode === undefined && obj.repeatOne === true) {
    settings.loopMode = 'one';
  }
  if (typeof obj.repeatCount === 'number' && Number.isInteger(obj.repeatCount) && obj.repeatCount >= 1 && obj.repeatCount <= 99) {
    settings.repeatCount = obj.repeatCount;
  }
  const rate = obj.playbackRate;
  if (typeof rate === 'number' && Number.isFinite(rate) && rate >= 0.1 && rate <= 4) {
    settings.playbackRate = rate;
  }
  return settings;
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings: Partial<UserSettings>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Storage failures must not interrupt playback or recording.
  }
}
