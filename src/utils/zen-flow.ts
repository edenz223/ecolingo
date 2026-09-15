import type { Sentence } from '../types/subtitles';
import type { RecordingMetadata, RecordingClip } from '../types/recording';

export interface ZenCompletionItem {
  sentence: Sentence;
  zenPhase?: string;
  [key: string]: any;
}

export interface ZenCompletionOptions {
  isCurrent: (completion: ZenCompletionItem) => boolean;
  playReference: (sentence: Sentence) => void;
  setPhase: (phase: string) => void;
  save: (meta: RecordingMetadata, blob: Blob) => Promise<RecordingClip>;
  preview: (clip: RecordingClip, onEnded: () => void) => Promise<void> | void;
  advance: (sentence: Sentence) => void;
  stop: () => void;
}

// A completed take is the only entry point: never advance before the recorder stops.
export function createZenCompletion({
  isCurrent,
  playReference,
  setPhase,
  save,
  preview,
  advance,
  stop,
}: ZenCompletionOptions) {
  return async (
    completion: ZenCompletionItem,
    meta: RecordingMetadata,
    blob: Blob
  ): Promise<void> => {
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
