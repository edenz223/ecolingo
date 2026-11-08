import { computed, ref, watch } from 'vue';
import { Player } from './player';
import { RecorderManager } from './recorder';
import { ZenCoordinator } from './zen';
import { loadSettings, saveSettings } from '../utils/settings';
import { clampPlaybackRate } from '../utils/playback-options';
import type { Lesson, RecordingClip } from '../types/recording';
import type { Sentence } from '../types/subtitles';
import type { PracticeMethod } from '../types/settings';

export interface LearningSessionOptions {
  // Scrolls the sentence list; only called while following is on and focus mode is off.
  scrollToSentence?: (sentence: Sentence) => void;
}

export type LearningSession = ReturnType<typeof createLearningSession>;

// Coordinates Player, RecorderManager and ZenCoordinator for the learning screen.
// Kept free of components and DOM so it can run under node tests.
export function createLearningSession(options: LearningSessionOptions = {}) {
  const settings = loadSettings();
  const drawerOpen = ref(settings.drawerOpen);
  const lessons = ref<Lesson[]>([]);
  const currentLessonIndex = ref(-1);
  const followSentence = ref(true);
  const lessonLoading = ref(false);
  const lessonError = ref('');
  const shadowingMode = ref(settings.shadowing);
  const focusMode = ref(false);
  const currentPlaybackRate = ref(settings.playbackRate);

  const player = new Player({
    playbackRate: currentPlaybackRate,
    loopMode: ref(settings.loopMode),
    repeatCount: ref(settings.repeatCount),
  });

  const recorder = new RecorderManager();

  const zen = new ZenCoordinator(
    player,
    recorder,
    shadowingMode,
    settings.practiceMethod,
    settings.practiceMethod === 'attempt'
  );

  const zenMode = zen.zenMode;
  const practiceMethod = zen.practiceMethod;
  const zenFirstAttempt = zen.zenFirstAttempt;
  const zenPhase = zen.zenPhase;

  const isRecording = computed(
    () => recorder.isRecording.value || recorder.isPreparingRecording.value
  );
  const recordingError = recorder.recordingError;
  const activeError = computed(() => {
    if (lessonError.value)
      return { source: 'lesson', title: '课程无法播放', message: lessonError.value } as const;
    if (recordingError.value)
      return { source: 'recording', title: '录音提示', message: recordingError.value } as const;
    return null;
  });

  recorder.setCallbacks({
    isShadowingActive: () => player.isShadowing.value,
    isShadowingModeActive: () => shadowingMode.value,
    getLoadSessionId: () => player.loadSessionId,
    getCurrentSentence: () => player.currentSentence.value,
    seekSentence: (start: number) => player.sound.value?.seek(start),
    stopPlayback: () => player.stopCurrentPlayback(),
    advanceSentence: () => {
      player.isShadowing.value = false;
      player.advanceSentence();
    },
    onRecordingComplete: (completion: any, meta: any, blob: Blob) => {
      zen.completeZenRecording(completion, meta, blob);
    },
  });

  player.setCallbacks({
    onListEnd: () => {
      if (lessons.value.length)
        playLesson((currentLessonIndex.value + 1) % lessons.value.length, true);
    },
    onLoadingChange: (loading: boolean) => {
      lessonLoading.value = loading;
    },
    onError: (msg: string) => {
      lessonError.value = msg;
    },
    onSentenceChange: (sentence: Sentence | null) => {
      if (focusMode.value || !followSentence.value || !sentence) return;
      options.scrollToSentence?.(sentence);
    },
    onSentenceBoundary: (sentence: Sentence) => {
      if (zenMode.value && zenPhase.value === 'reference') {
        player.sound.value?.pause();
        if (player.stepTimerId) {
          clearTimeout(player.stepTimerId);
          player.stepTimerId = null;
        }
        zenPhase.value = 'second';
        player.isShadowing.value = true;
        startSentenceRecording(sentence);
        return true;
      }
      if (shadowingMode.value && !zenMode.value) {
        if (!player.isShadowing.value) {
          player.sound.value?.pause();
          if (player.stepTimerId) {
            clearTimeout(player.stepTimerId);
            player.stepTimerId = null;
          }
          player.isShadowing.value = true;
          startSentenceRecording(sentence);
          return true;
        }
      }
      return false;
    },
    onPlayLessonStart: async (lesson: Lesson, sessionId: number) => {
      followSentence.value = true;
      const lessonId = await window.fileAPI.recordingIdentity(JSON.parse(JSON.stringify(lesson)));
      if (sessionId !== player.loadSessionId) return;
      recorder.activeLessonId = lessonId;
      await recorder.refreshRecordings(lessonId, sessionId);
    },
    onStopPlayback: () => {
      zen.resetSession();
      recorder.stopPreview();
      recorder.clearNoSpeechNotice();
      stopSentenceRecording(true);
      if (zenMode.value) recorder.releaseRecordingResources();
    },
    onReleaseLesson: () => recorder.releaseRecordingResources(),
    isZenReferencePlaying: () =>
      zenMode.value && zenPhase.value === 'reference' && Boolean(player.sound.value?.playing()),
    onTogglePlay: () => togglePlay(),
    handleZenClick: (sentence: Sentence, forcePlay?: boolean, wasPlayingZenReference?: boolean) => {
      if (zenMode.value && (forcePlay || wasPlayingZenReference)) {
        zen.playZenReference(sentence);
        return true;
      }
      if (zenMode.value) {
        return true;
      }
      return false;
    },
    stopPreview: () => recorder.stopPreview(),
  });

  watch(
    [
      currentPlaybackRate,
      shadowingMode,
      player.loopMode,
      player.repeatCount,
      drawerOpen,
      zenFirstAttempt,
      practiceMethod,
    ],
    ([
      playbackRate,
      shadowing,
      loopMode,
      repeatCount,
      drawerOpen,
      zenFirstAttempt,
      practiceMethod,
    ]) => {
      saveSettings({
        playbackRate,
        shadowing,
        loopMode,
        repeatCount,
        drawerOpen,
        zenFirstAttempt,
        practiceMethod,
      });
    },
    { flush: 'sync' }
  );

  function isPlaybackActive() {
    // Read the revision so render effects re-run when Howler starts or stops.
    void player.playbackRevision.value;
    return player.isShadowing.value || Boolean(player.sound.value?.playing());
  }

  function currentSentenceIndex() {
    const current = player.currentSentence.value;
    return current ? player.parsedSentences.value.indexOf(current) : -1;
  }

  function zenNeighbor(offset: number): string {
    const sentences = player.parsedSentences;
    const current = player.currentSentence.value;
    if (!current) return '';
    return sentences.value[sentences.value.indexOf(current) + offset]?.text || '';
  }

  function selectPracticeMethod(method: PracticeMethod) {
    zen.selectPracticeMethod(method);
  }

  function closeRecordingError() {
    recorder.closeRecordingError();
  }

  function closeActiveError() {
    if (lessonError.value) lessonError.value = '';
    else closeRecordingError();
  }

  function reopenFolderAfterError() {
    lessonError.value = '';
    openFolder();
  }

  function pauseFollowing() {
    followSentence.value = false;
  }

  function resumeFollowing() {
    followSentence.value = true;
    player.handleSentenceChange(player.currentSentence.value);
  }

  function playLesson(index: number, continuePlayback = false) {
    if (index >= 0 && index < lessons.value.length) {
      currentLessonIndex.value = index;
      player.playLesson(lessons.value[index], () => {
        if (continuePlayback && zenMode.value) zen.startZenSentence();
      });
    }
  }

  function togglePlay() {
    if (zenMode.value) {
      if (zenPhase.value !== 'idle') player.stopCurrentPlayback();
      else zen.startZenSentence();
      return;
    }
    recorder.stopPreview();
    if (player.sound.value?.playing() || player.isShadowing.value || isRecording.value) {
      const sentence = player.currentSentence.value;
      const wasShadowing = player.isShadowing.value || isRecording.value;
      player.stopCurrentPlayback();
      if (wasShadowing && sentence) player.sound.value?.seek(sentence.start);
    } else {
      player.sound.value?.play();
    }
  }

  function loadLocalLessons() {
    const localLessons = localStorage.getItem('lessons');
    if (localLessons) {
      lessons.value = JSON.parse(localLessons);
    }
  }

  function handleOpenFolderResult(values: Lesson[]) {
    if (values && values.length > 0) {
      lessons.value = values;
      localStorage.setItem('lessons', JSON.stringify(values));
    }
  }

  function beforeSentence() {
    const current = player.currentSentence.value;
    if (!current) return;
    const idx = player.parsedSentences.value.indexOf(current);
    if (idx > 0) {
      if (player.currentPause) clearTimeout(player.currentPause);
      player.clickSentence(player.parsedSentences.value[idx - 1]);
    }
  }

  function nextSentence() {
    const current = player.currentSentence.value;
    if (!current) return;
    const idx = player.parsedSentences.value.indexOf(current);
    if (idx >= 0 && idx < player.parsedSentences.value.length - 1) {
      if (player.currentPause) clearTimeout(player.currentPause);
      player.clickSentence(player.parsedSentences.value[idx + 1]);
    }
  }

  function prev() {
    if (player.sound.value?.playing()) {
      player.sound.value.pause();
    }

    if (currentLessonIndex.value > 0) {
      currentLessonIndex.value--;
    } else {
      currentLessonIndex.value = lessons.value.length - 1;
    }
    playLesson(currentLessonIndex.value);
  }

  function next() {
    if (player.sound.value?.playing()) {
      player.sound.value.pause();
    }

    if (currentLessonIndex.value < lessons.value.length - 1) {
      currentLessonIndex.value++;
    } else {
      currentLessonIndex.value = 0;
    }
    playLesson(currentLessonIndex.value);
  }

  function openFolder() {
    window.fileAPI?.openFolder();
  }

  function toggleShadowingMode() {
    if (!player.sound.value) return;
    player.stopCurrentPlayback();
    recorder.releaseRecordingResources();
    shadowingMode.value = !shadowingMode.value;
    zenMode.value = shadowingMode.value && practiceMethod.value !== 'listen';
    if (player.currentSentence.value) {
      player.sound.value.seek(player.currentSentence.value.start);
    }
  }

  function setPlaybackRate(rate: number) {
    if (!Number.isFinite(rate)) return;
    player.setPlaybackRate(clampPlaybackRate(rate));
  }

  function startSentenceRecording(sentence: Sentence) {
    recorder.startSentenceRecording(sentence, {
      lessonName: player.currentLesson?.name || '',
      loadSessionId: player.loadSessionId,
      zenMode: zenMode.value,
      zenPhase: zenPhase.value,
      zenSession: zen.zenSession,
      shadowingMode: shadowingMode.value,
    });
  }

  function finishShadowing(reason = 'manual') {
    recorder.finishShadowing(reason, {
      sessionId: player.loadSessionId,
      sentence: player.currentSentence.value,
      zenSession: zen.zenSession,
      zenPhase: zenMode.value ? zenPhase.value : null,
    });
  }

  function stopSentenceRecording(discard = false) {
    recorder.stopSentenceRecording(discard);
  }

  function previewRecording(clip: RecordingClip, onComplete: (() => void) | null = null) {
    return recorder.previewRecording(clip, onComplete);
  }

  function stopPreview() {
    recorder.stopPreview();
  }

  function playUserRecording(sentenceStart: number) {
    recorder.playUserRecording(sentenceStart);
  }

  function releaseRecordingResources() {
    recorder.releaseRecordingResources();
  }

  function recordCurrentSentence() {
    zen.recordCurrentSentence();
  }

  function start() {
    loadLocalLessons();
    window.fileAPI?.onFolderSelected((_event, values: Lesson[]) => {
      handleOpenFolderResult(values);
    });
  }

  function dispose() {
    recorder.clearNoSpeechNotice();
    player.releaseLesson();
    recorder.releaseRecordingResources();
  }

  return {
    player,
    recorder,
    zen,
    drawerOpen,
    lessons,
    currentLessonIndex,
    followSentence,
    lessonLoading,
    shadowingMode,
    focusMode,
    currentPlaybackRate,
    zenMode,
    practiceMethod,
    zenFirstAttempt,
    zenPhase,
    isRecording,
    recordingError,
    activeError,
    recordingRevision: recorder.recordingRevision,
    recordingVoiceActive: recorder.recordingVoiceActive,
    recordingStatus: recorder.recordingStatus,
    recordings: recorder.recordings,
    noSpeechSentence: recorder.noSpeechSentence,
    previewClipId: recorder.previewClipId,
    pendingSaves: recorder.pendingSaves,
    isPlaybackActive,
    currentSentenceIndex,
    zenNeighbor,
    selectPracticeMethod,
    closeRecordingError,
    closeActiveError,
    reopenFolderAfterError,
    pauseFollowing,
    resumeFollowing,
    playLesson,
    togglePlay,
    beforeSentence,
    nextSentence,
    prev,
    next,
    openFolder,
    toggleShadowingMode,
    setPlaybackRate,
    startSentenceRecording,
    finishShadowing,
    stopSentenceRecording,
    previewRecording,
    stopPreview,
    playUserRecording,
    releaseRecordingResources,
    recordCurrentSentence,
    start,
    dispose,
  };
}
