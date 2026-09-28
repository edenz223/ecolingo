import { ref, type Ref } from 'vue';
import type { Sentence } from '../types/subtitles';
import type { RecordingMetadata, RecordingClip } from '../types/recording';
import { createVoiceMonitor } from '../utils/voice-activity';
import { playRecordingRestartCue } from '../utils/recording-cue';

interface RecordingOptions {
  lessonName: string;
  loadSessionId: number;
  zenMode?: boolean;
  zenPhase?: string | null;
  zenSession?: number;
  shadowingMode?: boolean;
}

export interface RecorderCallbacks {
  onNoSpeech?: (sentence: Sentence) => void;
  onRecordingComplete?: (
    completion: any,
    meta: RecordingMetadata,
    blob: Blob
  ) => void;
  stopPlayback?: () => void;
  isShadowingActive?: () => boolean;
  isShadowingModeActive?: () => boolean;
  getLoadSessionId?: () => number;
  getCurrentSentence?: () => Sentence | null;
  seekSentence?: (start: number) => void;
  advanceSentence?: () => void;
}

export class RecorderManager {
  isRecording: Ref<boolean>;
  recordingVoiceActive: Ref<boolean>;
  recordingStatus: Ref<string>;
  recordingError: Ref<string>;
  recordings: Ref<Record<number, RecordingClip>>;
  noSpeechSentence: Ref<number | null>;
  previewClipId: Ref<string | null>;

  mediaRecorder: MediaRecorder | null;
  mediaStream: MediaStream | null;
  recordingChunks: BlobPart[];
  voiceMonitor: any;
  recordingAttempt: number;
  recordingStartedAt: number;
  completedShadow: any;
  pendingRecordingSentence: (RecordingMetadata & { duration?: number }) | null;
  recorderInitPromise: Promise<boolean> | null;
  discardNextRecording: boolean;
  previewAudio: HTMLAudioElement | null;
  previewUrl: string | null;
  previewSession: number;
  activeLessonId: string | null;
  microphoneSession: number;
  noSpeechNoticeTimer: ReturnType<typeof setTimeout> | null;
  pendingSaves: Set<Promise<any>>;
  callbacks: RecorderCallbacks;
  activeRecordingRequest: { sentence: Sentence; options: RecordingOptions } | null = null;
  restartCue: ReturnType<typeof playRecordingRestartCue> | null = null;
  isPreparingRecording = ref(false);
  recordingRevision = ref(0);

  constructor(callbacks: RecorderCallbacks = {}) {
    this.isRecording = ref(false);
    this.recordingVoiceActive = ref(false);
    this.recordingStatus = ref('');
    this.recordingError = ref('');
    this.recordings = ref({});
    this.noSpeechSentence = ref(null);
    this.previewClipId = ref(null);

    this.mediaRecorder = null;
    this.mediaStream = null;
    this.recordingChunks = [];
    this.voiceMonitor = null;
    this.recordingAttempt = 0;
    this.recordingStartedAt = 0;
    this.completedShadow = null;
    this.pendingRecordingSentence = null;
    this.recorderInitPromise = null;
    this.discardNextRecording = false;
    this.previewAudio = null;
    this.previewUrl = null;
    this.previewSession = 0;
    this.activeLessonId = null;
    this.microphoneSession = 0;
    this.noSpeechNoticeTimer = null;
    this.pendingSaves = new Set();
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: Partial<RecorderCallbacks>) {
    Object.assign(this.callbacks, callbacks);
  }

  clearNoSpeechNotice() {
    if (this.noSpeechNoticeTimer) {
      clearTimeout(this.noSpeechNoticeTimer);
      this.noSpeechNoticeTimer = null;
    }
    this.noSpeechSentence.value = null;
  }

  closeRecordingError() {
    this.recordingError.value = '';
  }

  async ensureRecorderAccess(): Promise<boolean> {
    if (typeof window === 'undefined') {
      this.recordingError.value = '录音仅支持桌面应用。';
      return false;
    }

    if (this.recorderInitPromise) {
      return this.recorderInitPromise;
    }

    if (this.mediaRecorder) {
      return true;
    }

    const hasNavigator = typeof navigator !== 'undefined';
    if (
      typeof window.MediaRecorder === 'undefined' ||
      !hasNavigator ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      this.recordingError.value = '当前环境不支持录音，请使用桌面应用。';
      return false;
    }

    const accessSession = this.microphoneSession;
    this.recorderInitPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(async (stream) => {
        if (accessSession !== this.microphoneSession) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        this.mediaStream = stream;
        this.mediaRecorder = new MediaRecorder(stream);
        const monitor = createVoiceMonitor(stream);
        this.voiceMonitor = monitor;
        await monitor.ready();
        if (accessSession !== this.microphoneSession) return false;
        const mediaRecorder = this.mediaRecorder;
        mediaRecorder.addEventListener('dataavailable', (e) => {
          if (this.mediaRecorder === mediaRecorder) this.handleRecorderData(e);
        });
        mediaRecorder.addEventListener('stop', () => {
          if (this.mediaRecorder === mediaRecorder) this.handleRecorderStop();
        });
        this.recordingError.value = '';
        return true;
      })
      .catch((error: any) => {
        if (accessSession !== this.microphoneSession) return false;
        if (this.callbacks.isShadowingActive?.()) {
          this.callbacks.stopPlayback?.();
          const cur = this.callbacks.getCurrentSentence?.();
          if (cur) this.callbacks.seekSentence?.(cur.start);
        }
        this.releaseRecordingResources();
        this.recordingError.value =
          error?.name === 'NotAllowedError'
            ? '麦克风访问被拒绝，请在系统设置中允许使用麦克风后重试。'
            : error?.name === 'NotFoundError'
            ? '未检测到麦克风，请连接麦克风后重试。'
            : `无法访问麦克风：${error?.message || '请检查设备连接。'}`;
        return false;
      })
      .finally(() => {
        if (accessSession === this.microphoneSession) {
          this.recorderInitPromise = null;
        }
      });

    return this.recorderInitPromise;
  }

  startSentenceRecording(
    sentence: Sentence,
    options: RecordingOptions
  ) {
    this.clearNoSpeechNotice();
    if (!sentence) return;

    const sessionId = options.loadSessionId;
    const maxMs = 10000;
    const attempt = ++this.recordingAttempt;
    this.recordingStatus.value = '正在准备麦克风…';

    this.ensureRecorderAccess()
      .then(async (ready) => {
        if (attempt !== this.recordingAttempt) return;
        if (!ready) {
          this.isPreparingRecording.value = false;
          this.callbacks.stopPlayback?.();
          this.callbacks.seekSentence?.(sentence.start);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
        const shadowingActive = this.callbacks.isShadowingModeActive
          ? this.callbacks.isShadowingModeActive()
          : Boolean(options.shadowingMode);
        const zenActive = options.zenMode;
        if (
          attempt !== this.recordingAttempt ||
          !this.mediaRecorder ||
          (!shadowingActive && !zenActive) ||
          !this.callbacks.isShadowingActive?.() ||
          this.callbacks.getLoadSessionId?.() !== sessionId ||
          this.callbacks.getCurrentSentence?.() !== sentence
        ) {
          if (attempt === this.recordingAttempt) this.isPreparingRecording.value = false;
          return;
        }

        if (this.mediaRecorder.state === 'recording' || this.pendingRecordingSentence) {
          this.callbacks.stopPlayback?.();
          this.callbacks.seekSentence?.(sentence.start);
          this.recordingError.value = '上一段录音正在结束，请按播放重试。';
          return;
        }
        this.stopPreview();

        const duration =
          Math.max((sentence.end ?? sentence.start) - sentence.start, 0) || 0;

        this.pendingRecordingSentence = {
          lessonId: this.activeLessonId || '',
          lessonName: options.lessonName,
          start: sentence.start,
          end: sentence.end,
          text: sentence.text,
          mime: this.mediaRecorder.mimeType || 'audio/webm',
          duration,
        };

        this.isRecording.value = true;
        this.isPreparingRecording.value = false;
        this.activeRecordingRequest = { sentence, options: { ...options } };
        this.recordingChunks = [];
        this.mediaRecorder.start();
        this.recordingStartedAt = performance.now();
        this.recordingError.value = '';
        this.voiceMonitor.start(
          ({ state, reason, voiceActive }: any) => {
            if (attempt !== this.recordingAttempt) return;
            this.recordingVoiceActive.value = Boolean(voiceActive);
            const statusMap: Record<string, string> = {
              waiting: '请开始跟读…',
              speaking: '正在录音…',
              silence: '等待说完：静音 1.2 秒后结束',
            };
            this.recordingStatus.value = statusMap[state] || '';
            if (reason) {
              this.finishShadowing(reason, {
                sessionId,
                sentence,
                zenSession: options.zenSession,
                zenPhase: options.zenMode ? options.zenPhase : null,
              });
            }
          },
          { maxMs }
        );
      })
      .catch((error: any) => {
        if (attempt !== this.recordingAttempt) return;
        this.callbacks.stopPlayback?.();
        this.callbacks.seekSentence?.(sentence.start);
        this.releaseRecordingResources();
        this.recordingError.value = `录音启动失败：${error.message}`;
      });
  }

  async restartSentenceRecording() {
    const mediaRecorder = this.mediaRecorder;
    const request = this.activeRecordingRequest;
    if (this.isPreparingRecording.value || !this.isRecording.value || mediaRecorder?.state !== 'recording' || !request) return;

    // Wait for final dataavailable/stop before reusing the recorder.
    const stopped = new Promise<void>((resolve) => {
      mediaRecorder.addEventListener('stop', () => resolve(), { once: true });
    });
    this.stopSentenceRecording(true);
    this.isPreparingRecording.value = true;
    this.recordingRevision.value++;
    const attempt = this.recordingAttempt;
    await stopped;
    if (this.mediaRecorder !== mediaRecorder) return;
    await this.prepareRecordingWithCue(request.sentence, request.options, attempt);
  }

  startSentenceRecordingWithCue(sentence: Sentence, options: RecordingOptions) {
    if (this.isPreparingRecording.value || this.isRecording.value) return;
    this.isPreparingRecording.value = true;
    this.recordingRevision.value++;
    return this.prepareRecordingWithCue(sentence, options, ++this.recordingAttempt);
  }

  private async prepareRecordingWithCue(sentence: Sentence, options: RecordingOptions, attempt: number) {
    const isCurrent = () =>
      attempt === this.recordingAttempt &&
      this.callbacks.isShadowingActive?.() &&
      this.callbacks.getLoadSessionId?.() === options.loadSessionId &&
      this.callbacks.getCurrentSentence?.() === sentence;
    const clearIfCancelled = () => {
      if (isCurrent()) return false;
      if (attempt === this.recordingAttempt) this.isPreparingRecording.value = false;
      return true;
    };

    if (clearIfCancelled()) return;
    this.recordingStatus.value = '准备重新录制…';
    const cue = playRecordingRestartCue();
    this.restartCue = cue;
    await cue.finished;
    if (this.restartCue === cue) this.restartCue = null;
    if (clearIfCancelled()) return;
    // Preserve the current Zen phase; do not replay the reference or advance.
    this.startSentenceRecording(sentence, options);
  }

  finishShadowing(
    reason = 'manual',
    context?: {
      sessionId: number;
      sentence: Sentence;
      zenSession?: number;
      zenPhase?: string | null;
    }
  ) {
    if (!this.isRecording.value || this.completedShadow) return;
    if (reason === 'no-speech') {
      this.callbacks.stopPlayback?.();
      const cur = this.callbacks.getCurrentSentence?.();
      if (cur) {
        this.callbacks.seekSentence?.(cur.start);
        this.noSpeechSentence.value = cur.start;
      }
      this.noSpeechNoticeTimer = setTimeout(() => {
        this.clearNoSpeechNotice();
      }, 1000);
      return;
    }
    const cur = context?.sentence || this.callbacks.getCurrentSentence?.();
    const sessionId = context?.sessionId ?? this.callbacks.getLoadSessionId?.() ?? 0;
    this.completedShadow = {
      sessionId,
      sentence: cur,
      zenSession: context?.zenSession,
      zenPhase: context?.zenPhase,
    };
    this.recordingStatus.value =
      reason === 'limit' ? '已达到 10 秒录音上限，正在保存…' : '正在完成录音…';
    this.stopSentenceRecording();
  }

  stopSentenceRecording(discard = false) {
    this.isPreparingRecording.value = false;
    this.restartCue?.cancel();
    this.restartCue = null;
    this.recordingVoiceActive.value = false;
    this.recordingAttempt++;
    this.voiceMonitor?.stop();

    if (discard) {
      this.completedShadow = null;
      this.recordingStatus.value = '';
      this.discardNextRecording = true;
    }

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
      return;
    }

    if (discard) {
      if (!this.pendingRecordingSentence) this.resetRecordingState();
    }
  }

  handleRecorderData(event: BlobEvent) {
    if (event.data && event.data.size > 0) {
      this.recordingChunks.push(event.data);
    }
  }

  handleRecorderStop() {
    this.voiceMonitor?.stop();
    const completion = this.completedShadow;
    this.completedShadow = null;

    const shouldDiscard = this.discardNextRecording;
    this.discardNextRecording = false;

    if (
      shouldDiscard ||
      !this.pendingRecordingSentence ||
      this.recordingChunks.length === 0
    ) {
      this.resetRecordingState();
      if (!shouldDiscard && completion) this.callbacks.stopPlayback?.();
      return;
    }

    const blob = new Blob(this.recordingChunks, {
      type: this.mediaRecorder?.mimeType || 'audio/webm',
    });

    this.pendingRecordingSentence.duration =
      (performance.now() - this.recordingStartedAt) / 1000;

    if (completion?.zenPhase) {
      const meta = this.pendingRecordingSentence;
      this.resetRecordingState();
      this.callbacks.onRecordingComplete?.(completion, meta, blob);
      return;
    }

    this.saveRecording(this.pendingRecordingSentence, blob);
    this.resetRecordingState();
    if (
      completion &&
      completion.sessionId === this.callbacks.getLoadSessionId?.() &&
      completion.sentence === this.callbacks.getCurrentSentence?.() &&
      this.callbacks.isShadowingActive?.()
    ) {
      this.callbacks.advanceSentence?.();
    }
  }

  saveRecording(meta: RecordingMetadata, blob: Blob): Promise<RecordingClip> {
    const sessionId = this.callbacks.getLoadSessionId?.() ?? 0;
    const task = (async () => {
      try {
        const clip = await window.fileAPI.saveRecording(
          {
            lessonId: meta.lessonId,
            lessonName: meta.lessonName,
            start: meta.start,
            end: meta.end,
            text: meta.text,
            mime: blob.type,
          },
          await blob.arrayBuffer()
        );
        if (
          sessionId === this.callbacks.getLoadSessionId?.() &&
          meta.lessonId === this.activeLessonId
        ) {
          this.recordings.value = {
            ...this.recordings.value,
            [meta.start]: clip,
          };
        }
        return clip;
      } catch (error: any) {
        this.recordingError.value = `录音保存失败：${error.message}`;
        throw error;
      }
    })();
    this.pendingSaves.add(task);
    task.finally(() => this.pendingSaves.delete(task)).catch(() => {});
    return task;
  }

  async refreshRecordings(
    lessonId = this.activeLessonId,
    sessionId = this.callbacks.getLoadSessionId?.() ?? 0
  ) {
    if (!lessonId) return;
    const clips = await window.fileAPI.listRecordings(lessonId);
    if (
      sessionId !== this.callbacks.getLoadSessionId?.() ||
      lessonId !== this.activeLessonId
    )
      return;
    const latest: Record<number, RecordingClip> = {};
    for (const clip of clips) {
      if (!latest[clip.start]) latest[clip.start] = clip;
    }
    this.recordings.value = latest;
  }

  resetRecordingState() {
    this.activeRecordingRequest = null;
    this.recordingVoiceActive.value = false;
    this.recordingStatus.value = '';
    this.isRecording.value = false;
    this.pendingRecordingSentence = null;
    this.recordingChunks = [];
    this.discardNextRecording = false;
  }

  playUserRecording(sentenceStart: number) {
    const clip = this.recordings.value[sentenceStart];
    if (clip) this.previewRecording(clip);
  }

  stopPreview() {
    this.previewSession++;
    this.previewClipId.value = null;
    if (this.previewAudio) {
      this.previewAudio.onended = null;
      this.previewAudio.onerror = null;
      this.previewAudio.pause();
      this.previewAudio.removeAttribute('src');
      this.previewAudio.load();
      this.previewAudio = null;
    }
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }

  async previewRecording(clip: RecordingClip, onComplete: (() => void) | null = null) {
    if (this.previewClipId.value === clip.id) {
      this.stopPreview();
      return;
    }
    if (!onComplete) this.callbacks.stopPlayback?.();
    this.stopPreview();
    this.previewClipId.value = clip.id;
    const session = this.previewSession;
    try {
      const { bytes, mime } = await window.fileAPI.readRecording(clip.id);
      if (session !== this.previewSession) return;
      this.previewUrl = URL.createObjectURL(new Blob([bytes as any], { type: mime }));
      this.previewAudio = new Audio(this.previewUrl);
      this.previewAudio.onended = () => {
        if (session === this.previewSession) {
          this.stopPreview();
          onComplete?.();
        }
      };
      this.previewAudio.onerror = () => {
        if (session !== this.previewSession) return;
        this.stopPreview();
        if (onComplete) this.callbacks.stopPlayback?.();
        this.recordingError.value = '录音无法播放，请检查录音文件是否完整。';
      };
      await this.previewAudio.play();
    } catch (error: any) {
      if (session === this.previewSession) {
        this.stopPreview();
        if (onComplete) this.callbacks.stopPlayback?.();
        this.recordingError.value = `录音播放失败：${error.message}`;
      }
    }
  }

  releaseRecordingResources() {
    this.isPreparingRecording.value = false;
    this.restartCue?.cancel();
    this.restartCue = null;
    this.recordingAttempt++;
    this.completedShadow = null;
    this.voiceMonitor?.dispose();
    this.voiceMonitor = null;
    this.microphoneSession++;
    this.recorderInitPromise = null;
    this.stopPreview();
    if (this.mediaRecorder) {
      this.mediaRecorder.removeEventListener('dataavailable', this.handleRecorderData);
      this.mediaRecorder.removeEventListener('stop', this.handleRecorderStop);
      if (this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.resetRecordingState();
  }
}
