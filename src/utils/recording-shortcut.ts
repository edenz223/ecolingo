export function createRecordingRestartShortcut(options: {
  canRecord: () => boolean;
  isBlocked: () => boolean;
  restart: () => void;
}) {
  return (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      event.code !== 'KeyR' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      !options.canRecord() ||
      options.isBlocked() ||
      target?.closest?.(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], .q-menu, [role="dialog"]'
      )
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) options.restart();
  };
}
