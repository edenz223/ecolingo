interface PlaybackShortcutOptions {
  isBlocked: () => boolean;
  canPlay: () => boolean;
  togglePlay: () => void;
}

export function createPlaybackShortcut(options: PlaybackShortcutOptions) {
  let spaceHeld = false;

  function consume(event: KeyboardEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function keydown(event: KeyboardEvent) {
    if (event.code !== 'Space') return;
    if (spaceHeld) {
      consume(event);
      return;
    }
    const target = event.target as HTMLElement | null;
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      options.isBlocked() ||
      target?.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], .q-menu, [role="dialog"]'
      )
    )
      return;

    spaceHeld = true;
    consume(event);
    if (!event.repeat && options.canPlay()) options.togglePlay();
  }

  function keyup(event: KeyboardEvent) {
    if (event.code !== 'Space' || !spaceHeld) return;
    // QItem also activates on keyup, even if keydown was prevented.
    consume(event);
    reset();
  }

  function reset() {
    spaceHeld = false;
  }

  return { keydown, keyup, reset };
}
