<template>
  <q-layout
    view="hHh lpR fFf"
    class="app-shell"
    :class="{ 'windows-titlebar': isWindows, 'app-shell--focus': focusMode }"
  >
    <q-header v-if="!focusMode" class="glass-header">
      <AppTitleBar
        :theme="theme"
        :subtitle-size="subtitleSize"
        @open-folder="session.openFolder"
        @show-shortcuts="showShortcuts = true"
        @select-theme="value => (theme = value)"
        @select-subtitle-size="value => (subtitleSize = value)"
        @update:menu-open="viewMenuOpen = $event"
      />
      <LessonHeading
        :lesson-name="lessons[currentLessonIndex]?.name || player.currentLesson?.name || ''"
        :sentence-position="Math.max(1, session.currentSentenceIndex() + 1)"
        :sentence-count="player.parsedSentences.value.length"
        :following="followSentence"
        :switching="lessonSwitching"
        :drawer-open="drawerOpen"
        @resume-following="session.resumeFollowing"
        @toggle-drawer="drawerOpen = !drawerOpen"
      />
    </q-header>

    <ActionHud :message="hudMessage" />

    <ShortcutsDialog v-model="showShortcuts" />

    <AppErrorDialog
      :error="activeError"
      @close="session.closeActiveError"
      @reopen-folder="session.reopenFolderAfterError"
    />

    <LessonDrawer
      v-if="!focusMode"
      v-model="drawerOpen"
      :lessons="lessons"
      :current-index="currentLessonIndex"
      :recorded-counts="recordedCounts"
      @select="index => session.playLesson(index)"
      @open-folder="session.openFolder"
    />

    <div v-if="dropActive" class="drop-overlay">
      <div class="drop-overlay__card">
        <q-icon name="folder_open" size="20px" />松开以打开课程文件夹
      </div>
    </div>

    <q-page-container>
      <q-page padding class="learning-page" :class="{ 'learning-page--focus': focusMode }">
        <LessonEmptyState
          v-if="!player.parsedSentences.value.length"
          :loading="lessonLoading"
          :lesson-count="lessons.length"
          :folder-name="lessonFolderName(lessons)"
          :resume="
            resumeTarget && {
              lessonName: resumeTarget.lesson.name,
              sentenceNumber: resumeTarget.sentenceIndex + 1,
            }
          "
          @resume="session.resumeLesson"
          @start="session.playLesson(0)"
          @open-folder="session.openFolder"
        />
        <ZenStage
          v-else-if="focusMode"
          :previous="session.zenNeighbor(-1)"
          :current="player.currentSentence.value?.text || ''"
          :next="session.zenNeighbor(1)"
          :sentence-key="player.currentSentence.value?.start"
          :status="practiceStatus"
        />
        <SentenceList
          v-else
          :sentences="player.parsedSentences.value"
          :current-sentence="player.currentSentence.value"
          :recordings="recordings"
          :preview-clip-id="previewClipId"
          :is-recording="isRecording"
          :no-speech-sentence="noSpeechSentence"
          :compare-sentence-start="compareSentenceStart"
          :switching="lessonSwitching"
          :status="practiceStatus"
          @sentence-click="(sentence, event) => player.handleSentenceClick(sentence, event)"
          @sentence-dblclick="sentence => player.doubleClickSentence(sentence)"
          @play-recording="session.playUserRecording"
          @compare="sentence => session.toggleCompare(sentence)"
          @browse="session.pauseFollowing"
        />
      </q-page>
    </q-page-container>

    <PlaybackBar
      ref="playbackBar"
      :focus-mode="focusMode"
      :has-lesson="Boolean(player.sound.value) || lessonSwitching"
      :has-sentence="Boolean(player.currentSentence.value)"
      :is-playing="session.isPlaybackActive()"
      :is-recording="isRecording"
      :recording-revision="recordingRevision"
      :recording-level="recordingLevel"
      :shadowing-mode="shadowingMode"
      :practice-method="practiceMethod"
      :loop-mode="player.loopMode.value"
      :repeat-count="player.repeatCount.value"
      :playback-rate="currentPlaybackRate"
      :pointer-interaction="pointerInteraction"
      @update:menu-open="controlsMenuOpen = $event"
      @toggle-play="session.togglePlay"
      @previous-sentence="session.beforeSentence"
      @next-sentence="session.nextSentence"
      @toggle-shadowing="session.toggleShadowingMode"
      @select-practice-method="session.selectPracticeMethod"
      @toggle-focus="focusMode = !focusMode"
      @select-loop-mode="mode => player.setLoopMode(mode)"
      @repeat-change="count => player.setRepeatCount(count)"
      @select-rate="session.setPlaybackRate"
    />
  </q-layout>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import ActionHud from '../components/ActionHud.vue';
import AppErrorDialog from '../components/AppErrorDialog.vue';
import AppTitleBar from '../components/AppTitleBar.vue';
import LessonDrawer from '../components/LessonDrawer.vue';
import LessonEmptyState from '../components/LessonEmptyState.vue';
import LessonHeading from '../components/LessonHeading.vue';
import PlaybackBar from '../components/PlaybackBar.vue';
import SentenceList from '../components/SentenceList.vue';
import ShortcutsDialog from '../components/ShortcutsDialog.vue';
import ZenStage from '../components/ZenStage.vue';
import { createLearningSession } from '../modules/learning-session';
import { practiceMethods } from '../modules/zen';
import { createKeyboardShortcuts } from '../utils/keyboard-shortcuts';
import { createPlaybackShortcut } from '../utils/playback-shortcut';
import { createRecordingRestartShortcut } from '../utils/recording-shortcut';
import { formatPlaybackRate } from '../utils/playback-options';
import { lessonFolderName } from '../utils/lesson-library';
import type { Sentence } from '../types/subtitles';

const isWindows = window.fileAPI?.platform === 'win32';
const showShortcuts = ref(false);
const pointerInteraction = ref(false);
const controlsMenuOpen = ref(false);
const viewMenuOpen = ref(false);
const playbackBar = ref<InstanceType<typeof PlaybackBar> | null>(null);

const session = createLearningSession({ scrollToSentence, notify: showHud });
const {
  player,
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
  practiceMethod,
  isRecording,
  activeError,
  practiceStatus,
  recordingRevision,
  recordingLevel,
  recordings,
  noSpeechSentence,
  previewClipId,
  compareSentenceStart,
  resumeTarget,
  recordedCounts,
} = session;

function scrollToSentence(sentence: Sentence) {
  const element = document.getElementById(sentence.start.toString());
  element?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
}

// Brief confirmation for keyboard commands whose control may be hidden (focus mode).
const hudMessage = ref('');
let hudTimer: ReturnType<typeof setTimeout> | null = null;

function showHud(message: string) {
  hudMessage.value = message;
  if (hudTimer) clearTimeout(hudTimer);
  hudTimer = setTimeout(() => {
    hudMessage.value = '';
    hudTimer = null;
  }, 1200);
}

function showRateHud() {
  showHud(`速度 ${formatPlaybackRate(currentPlaybackRate.value)}x`);
}

function showLessonHud() {
  const lesson = lessons.value[currentLessonIndex.value];
  if (lesson) showHud(`第 ${currentLessonIndex.value + 1} 课 · ${lesson.name}`);
}

function compareFromKeyboard() {
  if (session.toggleCompare() === 'unavailable') showHud('这句还没有录音');
}

function toggleShadowingFromKeyboard() {
  session.toggleShadowingMode();
  const method = practiceMethods.find(item => item.id === practiceMethod.value);
  showHud(shadowingMode.value ? `跟读已开启 · ${method?.label}` : '跟读已关闭');
}

watch(focusMode, val => {
  window.fileAPI?.setFocusMode?.(val);
});

watch(theme, value => window.fileAPI?.setTheme?.(value), { immediate: true });

// Subtitle size tokens are switched on <html> in app.scss.
watch(
  subtitleSize,
  value => {
    document.documentElement.dataset.subtitleSize = value;
  },
  { immediate: true }
);

function isKeyboardBlocked() {
  return (
    Boolean(activeError.value) ||
    showShortcuts.value ||
    controlsMenuOpen.value ||
    viewMenuOpen.value
  );
}

const playbackShortcut = createPlaybackShortcut({
  isBlocked: isKeyboardBlocked,
  canPlay: () => Boolean(player.sound.value),
  togglePlay: session.togglePlay,
});

const recordingRestartShortcut = createRecordingRestartShortcut({
  canRecord: () =>
    isRecording.value || Boolean(player.sound.value?.playing()) || Boolean(previewClipId.value),
  isBlocked: isKeyboardBlocked,
  restart: session.recordCurrentSentence,
});

const keyboardShortcut = createKeyboardShortcuts({
  isFocusMode: () => focusMode.value,
  isMenuOpen: () => controlsMenuOpen.value,
  closeMenus: () => playbackBar.value?.closeMenus(),
  exitFocusMode: () => {
    focusMode.value = false;
  },
  isBlocked: () => Boolean(activeError.value),
  hasLesson: () => Boolean(player.sound.value),
  pauseFollowing: session.pauseFollowing,
  toggleShadowing: toggleShadowingFromKeyboard,
  previousSentence: session.beforeSentence,
  nextSentence: session.nextSentence,
  previousLesson: () => {
    session.prev();
    showLessonHud();
  },
  nextLesson: () => {
    session.next();
    showLessonHud();
  },
  compareSentence: compareFromKeyboard,
  adjustPlaybackRate: delta => {
    session.setPlaybackRate(currentPlaybackRate.value + delta);
    showRateHud();
  },
  resetPlaybackRate: () => {
    session.setPlaybackRate(1);
    showRateHud();
  },
  reload: () => location.reload(),
});

function handleKeyDown(event: KeyboardEvent) {
  pointerInteraction.value = false;
  keyboardShortcut(event);
}

function handleScrollPointer(event: MouseEvent | PointerEvent) {
  if (event.clientX >= document.documentElement.clientWidth) session.pauseFollowing();
}

function handleGlobalPointerDown(e: Event) {
  pointerInteraction.value = true;
  const focusedElement = document.activeElement;
  if (
    focusedElement instanceof HTMLElement &&
    e.target instanceof Node &&
    !focusedElement.contains(e.target)
  ) {
    focusedElement.blur();
  }
  const target = (e.target as HTMLElement | null)?.closest?.(
    'button, .q-btn, [role="button"], [role="switch"]'
  );
  if (target) {
    target.dispatchEvent(new MouseEvent('mouseleave'));
  }
}

// Dropping a folder (or a file inside one) opens it; without preventDefault
// Electron would navigate the window to the dropped file.
const dropActive = ref(false);
let dragDepth = 0;

function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function handleDragEnter(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  dropActive.value = true;
}

function handleDragOver(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(event: DragEvent) {
  if (!carriesFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropActive.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragDepth = 0;
  dropActive.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  const droppedPath = window.fileAPI?.getPathForFile?.(file);
  if (droppedPath) void session.openFolderPath(droppedPath);
  else showHud('无法打开拖入的项目');
}

onMounted(() => {
  session.start();
  window.addEventListener('dragenter', handleDragEnter);
  window.addEventListener('dragover', handleDragOver);
  window.addEventListener('dragleave', handleDragLeave);
  window.addEventListener('drop', handleDrop);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keydown', playbackShortcut.keydown, true);
  window.addEventListener('keydown', recordingRestartShortcut, true);
  window.addEventListener('keyup', playbackShortcut.keyup, true);
  window.addEventListener('blur', playbackShortcut.reset);
  window.addEventListener('pointerdown', handleScrollPointer);
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
});

onUnmounted(() => {
  if (hudTimer) clearTimeout(hudTimer);
  if (focusMode.value) {
    window.fileAPI?.setFocusMode?.(false);
  }
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keydown', playbackShortcut.keydown, true);
  window.removeEventListener('keydown', recordingRestartShortcut, true);
  window.removeEventListener('keyup', playbackShortcut.keyup, true);
  window.removeEventListener('blur', playbackShortcut.reset);
  window.removeEventListener('pointerdown', handleScrollPointer);
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  window.removeEventListener('dragenter', handleDragEnter);
  window.removeEventListener('dragover', handleDragOver);
  window.removeEventListener('dragleave', handleDragLeave);
  window.removeEventListener('drop', handleDrop);
  session.dispose();
});
</script>

<style>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--backdrop);
  pointer-events: none;
}

.drop-overlay__card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  color: var(--ink-strong);
  background: var(--bg-raised);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-body);
  font-weight: 500;
}
</style>
