import { playbackRateStep } from './playback-options';

export interface KeyboardShortcutActions {
  isFocusMode: () => boolean;
  isMenuOpen: () => boolean;
  closeMenus: () => void;
  exitFocusMode: () => void;
  // True while a blocking dialog (such as an error) owns the keyboard.
  isBlocked: () => boolean;
  hasLesson: () => boolean;
  pauseFollowing: () => void;
  toggleShadowing: () => void;
  previousSentence: () => void;
  nextSentence: () => void;
  previousLesson: () => void;
  nextLesson: () => void;
  adjustPlaybackRate: (delta: number) => void;
  resetPlaybackRate: () => void;
  reload: () => void;
}

type ShortcutEvent = Pick<
  KeyboardEvent,
  'code' | 'target' | 'altKey' | 'metaKey' | 'ctrlKey' | 'preventDefault'
>;

const interactiveSelector =
  'input, textarea, select, button, [role="switch"], [role="slider"], [contenteditable="true"]';
// Native scrolling keys move the list, so stop following the playing sentence.
const browseKeys = ['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'];
const keysWithoutLesson = ['KeyQ', 'KeyE', 'KeyR'];

// Space and plain R are handled by playback-shortcut and recording-shortcut in the
// capture phase; this covers the remaining single-key commands.
export function createKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const commands: Record<string, () => void> = {
    KeyS: actions.toggleShadowing,
    KeyD: actions.nextSentence,
    KeyA: actions.previousSentence,
    KeyQ: actions.previousLesson,
    KeyE: actions.nextLesson,
    KeyC: () => actions.adjustPlaybackRate(playbackRateStep),
    KeyX: () => actions.adjustPlaybackRate(-playbackRateStep),
    KeyZ: actions.resetPlaybackRate,
    KeyR: actions.reload,
  };

  return function handleKeyDown(event: ShortcutEvent) {
    if (event.code === 'Escape' && actions.isFocusMode()) {
      if (actions.isMenuOpen()) actions.closeMenus();
      else actions.exitFocusMode();
      return;
    }
    const target = event.target as Element | null;
    if (
      actions.isBlocked() ||
      target?.closest?.(interactiveSelector) ||
      event.altKey ||
      event.metaKey
    )
      return;
    if (browseKeys.includes(event.code)) actions.pauseFollowing();
    if (!actions.hasLesson() && !keysWithoutLesson.includes(event.code)) return;
    if (event.ctrlKey && event.code !== 'KeyR') return;
    const command = commands[event.code];
    if (!command) return;
    if (event.code === 'KeyR' && !event.ctrlKey) return;
    event.preventDefault();
    command();
  };
}
