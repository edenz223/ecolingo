import { ref, type Ref } from 'vue';
import { Howl } from 'howler';
import type { Sentence } from '../types/subtitles';
import type { Lesson } from '../types/recording';
import { parseLRC, parseSRT } from '../utils/lyrics-util';

export interface PlayerCallbacks {
  onSentenceBoundary?: (sentence: Sentence, ended: boolean) => boolean | void;
  onSentenceChange?: (sentence: Sentence | null) => void;
  onPlayLessonStart?: (lesson: Lesson, sessionId: number) => Promise<void> | void;
  readTextFile?: (path: string) => Promise<string>;
  onError?: (message: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onStopPlayback?: () => void;
  onReleaseLesson?: () => void;
  onTogglePlay?: () => void;
  isZenReferencePlaying?: () => boolean;
  handleZenClick?: (sentence: Sentence, forcePlay: boolean, wasPlayingZenReference: boolean) => boolean;
  stopPreview?: () => void;
}

export interface PlayerOptions {
  playbackRate?: Ref<number>;
  repeatOne?: Ref<boolean>;
  callbacks?: PlayerCallbacks;
}

export class Player {
  loadSessionId: number;
  pendingSound: Howl | null;
  stepTimerId: ReturnType<typeof setTimeout> | null;
  sound: Ref<Howl | null>;
  currentLesson: Lesson | null;
  currentSentence: Ref<Sentence | null>;
  parsedSentences: Ref<Sentence[]>;
  isScrolling: Ref<boolean>;
  currentPause: ReturnType<typeof setTimeout> | null;
  repeatOne: Ref<boolean>;
  isShadowing: Ref<boolean>;
  playbackRate: Ref<number>;
  callbacks: PlayerCallbacks;

  constructor(options: PlayerOptions = {}) {
    this.loadSessionId = 0;
    this.pendingSound = null;
    this.stepTimerId = null;
    this.sound = ref(null);
    this.currentLesson = null;
    this.currentSentence = ref(null);
    this.parsedSentences = ref([]);
    this.isScrolling = ref(false);
    this.currentPause = null;
    this.repeatOne = options.repeatOne || ref(false);
    this.isShadowing = ref(false);
    this.playbackRate = options.playbackRate || ref(1);
    this.callbacks = options.callbacks || {};
  }

  setCallbacks(callbacks: Partial<PlayerCallbacks>) {
    Object.assign(this.callbacks, callbacks);
  }

  async playLesson(lesson: Lesson) {
    this.releaseLesson();
    this.callbacks.onLoadingChange?.(true);
    const sessionId = this.loadSessionId;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + '/' + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + '/' + lesson.audio.name;

    try {
      if (this.callbacks.onPlayLessonStart) {
        await this.callbacks.onPlayLessonStart(lesson, sessionId);
        if (sessionId !== this.loadSessionId) return;
      }
      const readFn =
        this.callbacks.readTextFile ||
        (typeof window !== 'undefined' && window.fileAPI?.readTextFile
          ? window.fileAPI.readTextFile.bind(window.fileAPI)
          : null);
      if (!readFn) throw new Error('无法读取字幕文件：缺少 readTextFile 接口');
      const content = await readFn(lyricsPath);
      if (sessionId !== this.loadSessionId) return;
      const sentences = lyricsPath.endsWith('.srt')
        ? parseSRT(content)
        : parseLRC(content);
      if (!sentences.length) throw new Error('字幕中没有可用的句子，请检查字幕文件。');
      this.initializeSound(audioFilePath, sentences, sessionId);
    } catch (error: any) {
      if (sessionId === this.loadSessionId) {
        this.callbacks.onLoadingChange?.(false);
        console.error('Error:', error);
        this.callbacks.onError?.(error.message || String(error));
      }
    }
  }

  releaseLesson() {
    this.callbacks.onLoadingChange?.(false);
    this.callbacks.onReleaseLesson?.();
    this.loadSessionId++;
    this.stopCurrentPlayback();
    if (this.stepTimerId) {
      clearTimeout(this.stepTimerId);
      this.stepTimerId = null;
    }
    this.pendingSound?.unload();
    this.pendingSound = null;
    this.sound.value?.unload();
    this.sound.value = null;
    this.currentLesson = null;
    this.currentSentence.value = null;
    this.parsedSentences.value = [];
    this.isScrolling.value = false;
  }

  initializeSound(audioFilePath: string, sentences: Sentence[], sessionId: number) {
    const sound = new Howl({
      preload: false,
      src: [audioFilePath],
      html5: true,
      format: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
      rate: this.playbackRate.value,
      onload: () => {
        if (sessionId !== this.loadSessionId) return;
        this.callbacks.onLoadingChange?.(false);
        if (sentences.length > 0) {
          sentences[sentences.length - 1].end = sound.duration();
        }
        this.pendingSound = null;
        this.sound.value = sound;
        this.parsedSentences.value = sentences;
        this.clickSentence(sentences[0]);
      },
      onloaderror: (id: unknown, error: unknown) => {
        if (sessionId !== this.loadSessionId) return;
        this.callbacks.onLoadingChange?.(false);
        this.callbacks.onError?.('课程音频无法打开，请检查文件是否存在且可以播放。');
        this.pendingSound = null;
        sound.unload();
        console.error('Error:', error);
      },
      onplay: () => {
        if (sessionId === this.loadSessionId) this.scheduleStep();
      },
      onplayerror: () => {
        if (sessionId !== this.loadSessionId) return;
        this.stopCurrentPlayback();
        this.callbacks.onError?.('原声无法播放，请检查音频文件后重试。');
      },
      onend: () => {
        if (sessionId === this.loadSessionId) this.step(true);
      },
    });
    this.pendingSound = sound;
    sound.load();
  }

  scheduleStep() {
    if (this.stepTimerId) clearTimeout(this.stepTimerId);
    const sessionId = this.loadSessionId;
    this.stepTimerId = setTimeout(() => {
      if (sessionId !== this.loadSessionId) return;
      this.stepTimerId = null;
      this.step();
    }, 20);
  }

  step(ended = false) {
    if (!this.sound.value || !this.currentSentence.value) return;
    if (this.isShadowing.value) return;
    if (!ended && !this.sound.value.playing()) return;

    const currentTime = ended ? this.sound.value.duration() : this.sound.value.seek() || 0;
    if (
      this.currentSentence.value &&
      this.currentSentence.value.end !== undefined &&
      currentTime >= this.currentSentence.value.end
    ) {
      if (this.callbacks.onSentenceBoundary) {
        const handled = this.callbacks.onSentenceBoundary(this.currentSentence.value, ended);
        if (handled) return;
      }
      this.advanceSentence();
      return;
    }
    const currentSentence = this.findCurrentSentence(currentTime);
    if (currentSentence && currentSentence !== this.currentSentence.value) {
      this.currentSentence.value = currentSentence;
      this.handleSentenceChange(currentSentence);
    }
    return this.scheduleStep();
  }

  advanceSentence() {
    if (this.repeatOne.value) {
      if (this.currentSentence.value) {
        this.sound.value?.seek(this.currentSentence.value.start);
      }
      if (this.sound.value && !this.sound.value.playing()) this.sound.value.play();
      this.scheduleStep();
      return;
    }
    const nextSentence = this.getNextSentence();
    if (!nextSentence) {
      this.sound.value?.pause();
      if (this.stepTimerId) {
        clearTimeout(this.stepTimerId);
        this.stepTimerId = null;
      }
      return;
    }
    this.currentSentence.value = nextSentence;
    this.sound.value?.seek(nextSentence.start);
    if (this.sound.value && !this.sound.value.playing()) this.sound.value.play();
    this.handleSentenceChange(nextSentence);
    this.scheduleStep();
  }

  findCurrentSentence(currentTime: number): Sentence | undefined {
    const sentences = this.parsedSentences.value;
    const currentSentence = sentences.find((sentence, index) => {
      const prevEnd = index > 0 && sentences[index - 1].end !== undefined ? sentences[index - 1].end! : 0;
      const end = sentence.end !== undefined ? sentence.end : Infinity;
      return currentTime >= prevEnd && currentTime < end;
    });
    return currentSentence || sentences[0];
  }

  handleSentenceChange(sentence: Sentence | null) {
    if (!sentence) return;
    if (this.callbacks.onSentenceChange) {
      this.callbacks.onSentenceChange(sentence);
      return;
    }
    if (typeof document !== 'undefined') {
      const element = document.getElementById(sentence.start.toString());
      element?.scrollIntoView({
        behavior: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'center',
      });
    }
  }

  getNextSentence(): Sentence | undefined {
    if (!this.currentSentence.value) return undefined;
    const currentIndex = this.parsedSentences.value.indexOf(this.currentSentence.value);
    return this.parsedSentences.value[currentIndex + 1];
  }

  async clickSentence(sentence: Sentence, forcePlay = false) {
    if (!this.sound.value || !sentence) return;
    const wasPlayingZenReference = this.callbacks.isZenReferencePlaying?.() ?? false;
    this.stopCurrentPlayback();
    this.callbacks.stopPreview?.();
    this.currentSentence.value = sentence;
    this.isShadowing.value = false;
    this.sound.value.seek(sentence.start);
    if (this.callbacks.handleZenClick) {
      const handled = this.callbacks.handleZenClick(sentence, forcePlay, wasPlayingZenReference);
      if (handled) {
        this.handleSentenceChange(sentence);
        return;
      }
    }
    this.sound.value.play();
    this.handleSentenceChange(sentence);
  }

  handleSentenceClick(sentence: Sentence, event?: MouseEvent) {
    if (event?.detail && event.detail > 1) return;
    return this.clickSentence(sentence);
  }

  doubleClickSentence(sentence: Sentence) {
    if (this.currentSentence.value === sentence && this.sound.value?.playing()) return;
    return this.clickSentence(sentence, true);
  }

  togglePlay() {
    if (this.callbacks.onTogglePlay) {
      this.callbacks.onTogglePlay();
      return;
    }
    this.callbacks.stopPreview?.();
    if (this.sound.value?.playing() || this.isShadowing.value) {
      const sentence = this.currentSentence.value;
      const wasShadowing = this.isShadowing.value;
      this.stopCurrentPlayback();
      if (wasShadowing && sentence) this.sound.value?.seek(sentence.start);
    } else {
      this.sound.value?.play();
    }
  }

  stopCurrentPlayback() {
    this.callbacks.onStopPlayback?.();
    if (this.stepTimerId) {
      clearTimeout(this.stepTimerId);
      this.stepTimerId = null;
    }
    if (this.sound.value?.playing()) {
      this.sound.value.pause();
    }
    if (this.currentPause) {
      clearTimeout(this.currentPause);
      this.currentPause = null;
    }
    this.isShadowing.value = false;
  }

  setPlaybackRate(rate: number) {
    this.playbackRate.value = rate;
    if (this.sound.value) {
      this.sound.value.rate(rate);
    }
  }
}
