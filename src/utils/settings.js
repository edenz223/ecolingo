const defaults = {
  volume: 100,
  muted: false,
  playbackRate: 1,
  shadowing: false,
  repeatOne: false,
  drawerOpen: true,
  zenFirstAttempt: true,
  practiceMethod: 'listen',
};
const storageKey = 'ecolingo.settings.v1';

function normalizeSettings(value) {
  const settings = { ...defaults };
  if (!value || typeof value !== 'object') return settings;
  if (['listen', 'replay', 'attempt'].includes(value.practiceMethod)) settings.practiceMethod = value.practiceMethod;
  for (const key of ['muted', 'shadowing', 'repeatOne', 'drawerOpen', 'zenFirstAttempt']) {
    if (typeof value[key] === 'boolean') settings[key] = value[key];
  }
  if (Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 100) {
    settings.volume = value.volume;
  }
  if (Number.isFinite(value.playbackRate) && value.playbackRate >= 0.1 && value.playbackRate <= 4) {
    settings.playbackRate = value.playbackRate;
  }
  return settings;
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(storageKey)));
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeSettings(settings)));
  } catch {
    // Storage failures must not interrupt playback or recording.
  }
}
