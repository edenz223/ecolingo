import { ref, type Ref } from 'vue';
import type { PracticeMethod } from '../types/settings';
import type { Sentence } from '../types/subtitles';
import type { RecordingMetadata } from '../types/recording';
import { createZenCompletion } from '../utils/zen-flow';
import type { Player } from './player';
import type { RecorderManager } from './recorder';

export const practiceMethods = [
  { id: 'listen', label: '先听后读', flow: '听原声 → 跟读' },
  { id: 'replay', label: '听读回听', flow: '听原声 → 跟读 → 听自己' },
  { id: 'attempt', label: '先读再听', flow: '先尝试 → 听原声 → 再跟读 → 听自己' },
] as const;

export class ZenCoordinator {
  practiceMethod: Ref<PracticeMethod>;
  zenMode: Ref<boolean>;
  zenFirstAttempt: Ref<boolean>;
  zenPhase: Ref<'idle' | 'first' | 'reference' | 'second' | 'preview'>;
  zenSession: number;
  completeZenRecording: (completion: any, meta: RecordingMetadata, blob: Blob) => void;

  player: Player;
  recorder: RecorderManager;
  shadowingMode: Ref<boolean>;

  constructor(
    player: Player,
    recorder: RecorderManager,
    shadowingMode: Ref<boolean>,
    initialMethod: PracticeMethod = 'listen',
    initialFirstAttempt = false
  ) {
    this.player = player;
    this.recorder = recorder;
    this.shadowingMode = shadowingMode;
    this.practiceMethod = ref(initialMethod);
    this.zenMode = ref(shadowingMode.value && initialMethod !== 'listen');
    this.zenFirstAttempt = ref(initialFirstAttempt);
    this.zenPhase = ref('idle');
    this.zenSession = 0;

    this.completeZenRecording = createZenCompletion({
      isCurrent: (completion: any) =>
        this.zenMode.value &&
        completion.zenSession === this.zenSession &&
        completion.sessionId === this.player.loadSessionId &&
        completion.sentence === this.player.currentSentence.value,
      playReference: (sentence: Sentence) => this.playZenReference(sentence),
      setPhase: (phase: any) => {
        this.zenPhase.value = phase;
      },
      save: (meta: RecordingMetadata, blob: Blob) =>
        this.recorder.saveRecording(meta, blob),
      preview: (clip: any, onComplete: any) =>
        this.recorder.previewRecording(clip, onComplete),
      advance: () => {
        const next = this.player.completeSentence();
        if (!next) {
          if (this.player.continueLessonList()) return;
          this.player.stopCurrentPlayback();
          this.recorder.releaseRecordingResources();
          return;
        }
        this.player.currentSentence.value = next;
        this.player.handleSentenceChange(next);
        this.startZenSentence();
      },
      stop: () => this.player.stopCurrentPlayback(),
    });
  }

  selectPracticeMethod(method: PracticeMethod) {
    if (
      !this.shadowingMode.value ||
      !this.player.sound.value ||
      !practiceMethods.some((item) => item.id === method)
    )
      return;
    this.player.stopCurrentPlayback();
    this.recorder.releaseRecordingResources();
    if (this.player.currentSentence.value) {
      this.player.sound.value.seek(this.player.currentSentence.value.start);
    }
    this.practiceMethod.value = method;
    this.zenMode.value = this.shadowingMode.value && method !== 'listen';
    this.zenFirstAttempt.value = method === 'attempt';
  }

  startZenSentence() {
    if (!this.player.currentSentence.value) return;
    this.recorder.clearNoSpeechNotice();
    if (!this.zenFirstAttempt.value) {
      this.playZenReference(this.player.currentSentence.value);
      return;
    }
    this.zenPhase.value = 'first';
    this.player.isShadowing.value = true;
    if (this.player.sound.value) {
      this.player.sound.value.seek(this.player.currentSentence.value.start);
    }
    this.recorder.startSentenceRecording(this.player.currentSentence.value, {
      lessonName: this.player.currentLesson?.name || '',
      loadSessionId: this.player.loadSessionId,
      zenMode: this.zenMode.value,
      zenPhase: this.zenPhase.value,
      zenSession: this.zenSession,
      shadowingMode: this.shadowingMode.value,
    });
  }

  recordCurrentSentence() {
    if (this.recorder.isPreparingRecording.value) return;
    if (this.recorder.isRecording.value) {
      void this.recorder.restartSentenceRecording();
      return;
    }
    const sentence = this.player.currentSentence.value;
    if (!sentence || (!this.player.sound.value?.playing() && !this.recorder.previewClipId.value)) return;

    this.player.sound.value?.pause();
    if (this.player.stepTimerId) {
      clearTimeout(this.player.stepTimerId);
      this.player.stepTimerId = null;
    }
    if (this.player.currentPause) {
      clearTimeout(this.player.currentPause);
      this.player.currentPause = null;
    }
    this.recorder.stopPreview();
    this.shadowingMode.value = true;
    this.zenMode.value = this.practiceMethod.value !== 'listen';
    if (this.zenMode.value) this.zenPhase.value = 'second';
    this.player.isShadowing.value = true;
    void this.recorder.startSentenceRecordingWithCue(sentence, {
      lessonName: this.player.currentLesson?.name || '',
      loadSessionId: this.player.loadSessionId,
      zenMode: this.zenMode.value,
      zenPhase: this.zenPhase.value,
      zenSession: this.zenSession,
      shadowingMode: true,
    });
  }

  playZenReference(sentence: Sentence) {
    this.zenPhase.value = 'reference';
    this.player.isShadowing.value = false;
    if (this.player.sound.value) {
      this.player.sound.value.seek(sentence.start);
      this.player.sound.value.play();
    }
  }

  resetSession() {
    this.zenSession++;
    this.zenPhase.value = 'idle';
  }
}
