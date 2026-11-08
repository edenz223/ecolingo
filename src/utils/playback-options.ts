import type { LoopMode } from '../types/settings';

export const loopModes: ReadonlyArray<{ id: LoopMode; label: string }> = [
  { id: 'off', label: '顺序播放' },
  { id: 'list', label: '列表循环' },
  { id: 'one', label: '单句循环' },
];

export const playbackRates = [0.5, 0.75, 1, 1.25, 1.5];
export const playbackRateStep = 0.1;
export const minPlaybackRate = 0.1;
export const maxPlaybackRate = 4;

// Round to hundredths so repeated 0.1 steps never drift into float noise.
export function clampPlaybackRate(rate: number): number {
  const clamped = Math.min(maxPlaybackRate, Math.max(minPlaybackRate, rate));
  return Math.round(clamped * 100) / 100;
}

export function formatPlaybackRate(rate: number): string {
  return String(clampPlaybackRate(rate));
}

export function isSameRate(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

export function describeLoopMode(mode: LoopMode, repeatCount: number): string {
  if (mode === 'one') return repeatCount === 0 ? '单句循环无限次' : `单句循环${repeatCount}次`;
  return loopModes.find(item => item.id === mode)?.label || '';
}
