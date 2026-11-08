import { ref, type Ref } from 'vue';
import type { Sentence } from '../types/subtitles';
import type { Player } from './player';
import type { RecorderManager } from './recorder';

export type ComparePhase = 'idle' | 'original' | 'gap' | 'recording';

// Same pause the shadowing flow leaves between the original and the learner.
export const compareGapMs = 500;

// A/B comparison: the original sentence, a short pause, then the latest take.
// Any stop of playback cancels it through cancel(); stale timers and preview
// callbacks are ignored by checking the session counter.
export class CompareCoordinator {
  phase: Ref<ComparePhase>;
  sentenceStart: Ref<number | null>;
  player: Player;
  recorder: RecorderManager;
  session = 0;
  gapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(player: Player, recorder: RecorderManager) {
    this.player = player;
    this.recorder = recorder;
    this.phase = ref('idle');
    this.sentenceStart = ref(null);
  }

  isActive() {
    return this.phase.value !== 'idle';
  }

  canCompare(sentence: Sentence | null | undefined) {
    return Boolean(
      sentence && this.player.sound.value && this.recorder.recordings.value[sentence.start]
    );
  }

  start(sentence: Sentence): boolean {
    if (!this.canCompare(sentence)) return false;
    // Stopping playback also resets any comparison already running.
    this.player.stopCurrentPlayback();
    this.recorder.stopPreview();
    this.session++;
    this.player.currentSentence.value = sentence;
    this.player.handleSentenceChange(sentence);
    this.sentenceStart.value = sentence.start;
    this.phase.value = 'original';
    this.player.sound.value!.seek(sentence.start);
    this.player.sound.value!.play();
    return true;
  }

  // Called at the end of the original sentence; true means the boundary was handled.
  handleBoundary(sentence: Sentence): boolean {
    if (this.phase.value !== 'original') return false;
    this.player.sound.value?.pause();
    if (this.player.stepTimerId) {
      clearTimeout(this.player.stepTimerId);
      this.player.stepTimerId = null;
    }
    this.phase.value = 'gap';
    const session = this.session;
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      if (session !== this.session) return;
      const clip = this.recorder.recordings.value[sentence.start];
      if (!clip) {
        this.finish(sentence);
        return;
      }
      this.phase.value = 'recording';
      void this.recorder.previewRecording(clip, () => {
        if (session === this.session) this.finish(sentence);
      });
    }, compareGapMs);
    return true;
  }

  cancel() {
    this.session++;
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
    this.phase.value = 'idle';
    this.sentenceStart.value = null;
  }

  finish(sentence: Sentence) {
    this.cancel();
    this.player.sound.value?.seek(sentence.start);
  }
}
