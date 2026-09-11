// A completed take is the only entry point: never advance before the recorder stops.
export function createZenCompletion({ isCurrent, playReference, setPhase, save, preview, advance, stop }) {
  return async (completion, meta, blob) => {
    const current = () => isCurrent(completion);
    if (!current()) return;
    if (completion.zenPhase === 'first') {
      playReference(completion.sentence);
      return;
    }
    setPhase('saving');
    try {
      const clip = await save(meta, blob);
      if (!current()) return;
      setPhase('preview');
      await preview(clip, () => {
        if (current()) advance(completion.sentence);
      });
    } catch {
      if (current()) stop();
    }
  };
}
