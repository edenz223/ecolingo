import type { UserSettings, PracticeMethod } from '../types/settings';

const defaults: UserSettings = {
  playbackRate: 1,
  shadowing: false,
  repeatOne: false,
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
  for (const key of ['shadowing', 'repeatOne', 'drawerOpen', 'zenFirstAttempt'] as const) {
    if (typeof obj[key] === 'boolean') {
      settings[key] = obj[key] as boolean;
    }
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
