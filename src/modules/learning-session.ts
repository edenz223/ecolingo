import { computed, ref, watch } from 'vue';
import { Player } from './player';
import { RecorderManager } from './recorder';
import { ZenCoordinator } from './zen';
import { CompareCoordinator } from './compare';
import { loadSettings, saveSettings } from '../utils/settings';
import { clampPlaybackRate } from '../utils/playback-options';
import { derivePracticeStatus } from '../utils/practice-status';
import { findResumeTarget, lessonKey } from '../utils/lesson-library';
import type { Lesson } from '../types/recording';
import type { Sentence } from '../types/subtitles';
import type { PracticeMethod } from '../types/settings';

export interface LearningSessionOptions {
  // Scrolls the sentence list; only called while following is on and focus mode is off.
  scrollToSentence?: (sentence: Sentence) => void;
  // Short, non-blocking feedback such as "no lessons in this folder".
  notify?: (message: string) => void;
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
  const resumePoint = ref(settings.resume);
  const theme = ref(settings.theme);
  const subtitleSize = ref(settings.subtitleSize);
  // Key of the lesson whose audio and subtitles finished loading; null while switching.
  const loadedLessonKey = ref<string | null>(null);
  // Sentences with at least one take, per lesson key.
  const recordedCounts = ref<Record<string, number>>({});
  let recordingsLessonKey: string | null = null;
  let countsSession = 0;
  const currentPlaybackRate = ref(settings.playbackRate);

  const player = new Player({
    playbackRate: currentPlaybackRate,
    loopMode: ref(settings.loopMode),
    repeatCount: ref(settings.repeatCount),
  });

  // Another lesson is loading while the previous one's sentences stay on screen.
  const lessonSwitching = computed(
    () => lessonLoading.value && player.parsedSentences.value.length > 0
  );

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
  const compare = new CompareCoordinator(player, recorder);

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

  const practiceStatus = computed(() => {
    // Read the revision so the status follows Howler starting or stopping.
    void player.playbackRevision.value;
    return derivePracticeStatus({
      shadowingMode: shadowingMode.value && Boolean(player.sound.value),
      practiceMethod: practiceMethod.value,
      zenPhase: zenPhase.value,
      comparePhase: compare.phase.value,
      isRecording: isRecording.value,
      isShadowing: player.isShadowing.value,
      isPlayingReference: !player.isShadowing.value && Boolean(player.sound.value?.playing()),
      noSpeech: recorder.noSpeechSentence.value !== null,
    });
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
      if (compare.handleBoundary(sentence)) return true;
      if (zenMode.value && zenPhase.value === 'reference') {
        zenPhase.value = 'second';
        beginShadowing(sentence);
        return true;
      }
      if (shadowingMode.value && !zenMode.value && !player.isShadowing.value) {
        beginShadowing(sentence);
        return true;
      }
      return false;
    },
    onPlayLessonStart: async (lesson: Lesson, sessionId: number) => {
      followSentence.value = true;
      recordingsLessonKey = null;
      const lessonId = await window.fileAPI.recordingIdentity(JSON.parse(JSON.stringify(lesson)));
      if (sessionId !== player.loadSessionId) return;
      recorder.activeLessonId = lessonId;
      await recorder.refreshRecordings(lessonId, sessionId);
      if (sessionId !== player.loadSessionId) return;
      recordingsLessonKey = lessonKey(lesson);
      setRecordedCount(recordingsLessonKey, Object.keys(recorder.recordings.value).length);
    },
    onStopPlayback: () => {
      compare.cancel();
      zen.resetSession();
      recorder.stopPreview();
      recorder.clearNoSpeechNotice();
      recorder.stopSentenceRecording(true);
      if (zenMode.value) recorder.releaseRecordingResources();
    },
    onReleaseLesson: () => {
      compare.cancel();
      recorder.releaseRecordingResources();
    },
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
    () => ({
      playbackRate: currentPlaybackRate.value,
      shadowing: shadowingMode.value,
      loopMode: player.loopMode.value,
      repeatCount: player.repeatCount.value,
      drawerOpen: drawerOpen.value,
      zenFirstAttempt: zenFirstAttempt.value,
      practiceMethod: practiceMethod.value,
      resume: resumePoint.value,
      theme: theme.value,
      subtitleSize: subtitleSize.value,
    }),
    saveSettings,
    { flush: 'sync' }
  );

  watch([player.currentSentence, loadedLessonKey], ([sentence, key]) => {
    if (!sentence || !key) return;
    const sentenceIndex = player.parsedSentences.value.indexOf(sentence);
    if (sentenceIndex < 0) return;
    resumePoint.value = { lessonKey: key, sentenceStart: sentence.start, sentenceIndex };
  });

  // Open the microphone while the original plays, so recording can begin right
  // after the sentence instead of waiting for the device and audio graph to start.
  watch(player.playbackRevision, () => {
    if (shadowingMode.value && !compare.isActive() && player.sound.value?.playing())
      void recorder.ensureRecorderAccess();
  });

  // Keep the open lesson's count live as takes are saved.
  watch(recorder.recordings, recordings => {
    if (recordingsLessonKey) setRecordedCount(recordingsLessonKey, Object.keys(recordings).length);
  });

  watch(lessons, list => {
    void refreshRecordedCounts(list);
  });

  const resumeTarget = computed(() => findResumeTarget(lessons.value, resumePoint.value));

  function setRecordedCount(key: string, count: number) {
    if (recordedCounts.value[key] === count) return;
    recordedCounts.value = { ...recordedCounts.value, [key]: count };
  }

  // One lesson at a time: identities are hashed in the main process and cached there.
  async function refreshRecordedCounts(list: Lesson[]) {
    const session = ++countsSession;
    recordedCounts.value = {};
    for (const lesson of list) {
      try {
        const count = await window.fileAPI?.recordingCount?.(JSON.parse(JSON.stringify(lesson)));
        if (session !== countsSession) return;
        if (typeof count === 'number') setRecordedCount(lessonKey(lesson), count);
      } catch {
        // A missing or unreadable file only hides that lesson's count.
      }
    }
  }

  function isPlaybackActive() {
    // Read the revision so render effects re-run when Howler starts or stops.
    void player.playbackRevision.value;
    return compare.isActive() || player.isShadowing.value || Boolean(player.sound.value?.playing());
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

  function closeActiveError() {
    if (lessonError.value) lessonError.value = '';
    else recorder.closeRecordingError();
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

  // startAt jumps to the sentence beginning at that time once the lesson is ready.
  function playLesson(index: number, continuePlayback = false, startAt?: number) {
    if (index >= 0 && index < lessons.value.length) {
      const lesson = lessons.value[index];
      currentLessonIndex.value = index;
      loadedLessonKey.value = null;
      player.playLesson(
        lesson,
        () => {
          loadedLessonKey.value = lessonKey(lesson);
          if (continuePlayback && zenMode.value) zen.startZenSentence();
        },
        startAt
      );
    }
  }

  function resumeLesson() {
    const target = resumeTarget.value;
    if (target) playLesson(target.index, false, resumePoint.value?.sentenceStart);
  }

  function togglePlay() {
    if (!player.sound.value) return;
    if (compare.isActive()) {
      stopCompare();
      return;
    }
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
      // The open lesson keeps playing; point the index at it in the new list (or nowhere).
      const openKey = player.currentLesson ? lessonKey(player.currentLesson) : null;
      currentLessonIndex.value = openKey
        ? values.findIndex(lesson => lessonKey(lesson) === openKey)
        : -1;
      lessons.value = values;
      localStorage.setItem('lessons', JSON.stringify(values));
    } else {
      options.notify?.('这个文件夹里没有成对的音频和字幕');
    }
  }

  async function openFolderPath(folderPath: string) {
    const opened = await window.fileAPI?.openFolderPath?.(folderPath);
    if (!opened) options.notify?.('无法打开拖入的项目');
  }

  function stepSentence(offset: number) {
    const idx = currentSentenceIndex();
    const target = idx >= 0 ? player.parsedSentences.value[idx + offset] : undefined;
    if (!target) return;
    if (player.currentPause) clearTimeout(player.currentPause);
    player.clickSentence(target);
  }

  // Wraps around the list; with no lesson selected, previous opens the last and next the first.
  function stepLesson(offset: number) {
    if (player.sound.value?.playing()) player.sound.value.pause();
    const count = lessons.value.length;
    const index = currentLessonIndex.value;
    if (!count) return;
    playLesson(index < 0 ? (offset < 0 ? count - 1 : 0) : (index + offset + count) % count);
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

  // Pauses the reference at a sentence boundary and records the learner.
  function beginShadowing(sentence: Sentence) {
    player.sound.value?.pause();
    if (player.stepTimerId) {
      clearTimeout(player.stepTimerId);
      player.stepTimerId = null;
    }
    player.isShadowing.value = true;
    startSentenceRecording(sentence);
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

  function playUserRecording(sentenceStart: number) {
    if (compare.isActive()) stopCompare();
    recorder.playUserRecording(sentenceStart);
  }

  function recordCurrentSentence() {
    compare.cancel();
    zen.recordCurrentSentence();
  }

  function stopCompare() {
    const sentence = player.currentSentence.value;
    player.stopCurrentPlayback();
    if (sentence) player.sound.value?.seek(sentence.start);
  }

  // Starts or stops the A/B comparison; 'unavailable' means the sentence has no take.
  function toggleCompare(sentence = player.currentSentence.value) {
    if (compare.isActive() && compare.sentenceStart.value === sentence?.start) {
      stopCompare();
      return 'stopped' as const;
    }
    return sentence && compare.start(sentence) ? ('started' as const) : ('unavailable' as const);
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
    lessonSwitching,
    shadowingMode,
    focusMode,
    theme,
    subtitleSize,
    currentPlaybackRate,
    zenMode,
    practiceMethod,
    zenFirstAttempt,
    zenPhase,
    isRecording,
    activeError,
    practiceStatus,
    resumeTarget,
    recordedCounts,
    comparePhase: compare.phase,
    compareSentenceStart: compare.sentenceStart,
    recordingRevision: recorder.recordingRevision,
    recordingLevel: recorder.recordingLevel,
    recordings: recorder.recordings,
    noSpeechSentence: recorder.noSpeechSentence,
    previewClipId: recorder.previewClipId,
    isPlaybackActive,
    currentSentenceIndex,
    zenNeighbor,
    selectPracticeMethod,
    closeActiveError,
    reopenFolderAfterError,
    pauseFollowing,
    resumeFollowing,
    playLesson,
    resumeLesson,
    togglePlay,
    previousSentence: () => stepSentence(-1),
    nextSentence: () => stepSentence(1),
    previousLesson: () => stepLesson(-1),
    nextLesson: () => stepLesson(1),
    openFolder,
    openFolderPath,
    toggleShadowingMode,
    setPlaybackRate,
    finishShadowing,
    playUserRecording,
    recordCurrentSentence,
    toggleCompare,
    start,
    dispose,
  };
}
