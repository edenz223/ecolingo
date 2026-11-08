<template>
  <q-layout
    view="hHh lpR fFf"
    class="app-shell"
    :class="{ 'windows-titlebar': isWindows, 'app-shell--focus': focusMode }"
  >
    <q-header v-if="!focusMode" class="glass-header">
      <AppTitleBar @open-folder="session.openFolder" @show-shortcuts="showShortcuts = true" />
      <LessonHeading
        :lesson-name="lessons[currentLessonIndex]?.name || player.currentLesson?.name || ''"
        :sentence-position="Math.max(1, session.currentSentenceIndex() + 1)"
        :sentence-count="player.parsedSentences.value.length"
        :following="followSentence"
        :drawer-open="drawerOpen"
        @resume-following="session.resumeFollowing"
        @toggle-drawer="drawerOpen = !drawerOpen"
      />
    </q-header>

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
      @select="index => session.playLesson(index)"
    />

    <q-page-container>
      <q-page padding class="learning-page" :class="{ 'learning-page--focus': focusMode }">
        <div v-if="!player.parsedSentences.value.length" class="lesson-empty">
          <q-icon name="headphones" size="48px" color="primary" />
          <div class="text-h6">{{ lessonLoading ? '正在打开课程…' : '开始今天的跟读' }}</div>
          <div class="text-grey-7">选择包含音频和字幕的文件夹</div>
          <q-btn
            unelevated
            color="primary"
            icon="folder_open"
            label="打开课程文件夹"
            :loading="lessonLoading"
            @click="session.openFolder"
          />
        </div>
        <ZenStage
          v-else-if="focusMode"
          :previous="session.zenNeighbor(-1)"
          :current="player.currentSentence.value?.text || ''"
          :next="session.zenNeighbor(1)"
          :sentence-key="player.currentSentence.value?.start"
        />
        <SentenceList
          v-else
          :sentences="player.parsedSentences.value"
          :current-sentence="player.currentSentence.value"
          :recordings="recordings"
          :preview-clip-id="previewClipId"
          :is-recording="isRecording"
          :no-speech-sentence="noSpeechSentence"
          @sentence-click="(sentence, event) => player.handleSentenceClick(sentence, event)"
          @sentence-dblclick="sentence => player.doubleClickSentence(sentence)"
          @play-recording="session.playUserRecording"
          @browse="session.pauseFollowing"
        />
      </q-page>
    </q-page-container>

    <PlaybackBar
      ref="playbackBar"
      :focus-mode="focusMode"
      :has-lesson="Boolean(player.sound.value)"
      :has-sentence="Boolean(player.currentSentence.value)"
      :is-playing="session.isPlaybackActive()"
      :is-recording="isRecording"
      :recording-revision="recordingRevision"
      :recording-voice-active="recordingVoiceActive"
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
import AppErrorDialog from '../components/AppErrorDialog.vue';
import AppTitleBar from '../components/AppTitleBar.vue';
import LessonDrawer from '../components/LessonDrawer.vue';
import LessonHeading from '../components/LessonHeading.vue';
import PlaybackBar from '../components/PlaybackBar.vue';
import SentenceList from '../components/SentenceList.vue';
import ShortcutsDialog from '../components/ShortcutsDialog.vue';
import ZenStage from '../components/ZenStage.vue';
import { createLearningSession } from '../modules/learning-session';
import { createKeyboardShortcuts } from '../utils/keyboard-shortcuts';
import { createPlaybackShortcut } from '../utils/playback-shortcut';
import { createRecordingRestartShortcut } from '../utils/recording-shortcut';
import type { Sentence } from '../types/subtitles';

const isWindows = window.fileAPI?.platform === 'win32';
const showShortcuts = ref(false);
const pointerInteraction = ref(false);
const controlsMenuOpen = ref(false);
const playbackBar = ref<InstanceType<typeof PlaybackBar> | null>(null);

const session = createLearningSession({ scrollToSentence });
const {
  player,
  drawerOpen,
  lessons,
  currentLessonIndex,
  followSentence,
  lessonLoading,
  shadowingMode,
  focusMode,
  currentPlaybackRate,
  practiceMethod,
  isRecording,
  activeError,
  recordingRevision,
  recordingVoiceActive,
  recordings,
  noSpeechSentence,
  previewClipId,
} = session;

function scrollToSentence(sentence: Sentence) {
  const element = document.getElementById(sentence.start.toString());
  element?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
}

watch(focusMode, val => {
  window.fileAPI?.setFocusMode?.(val);
});

function isKeyboardBlocked() {
  return Boolean(activeError.value) || showShortcuts.value || controlsMenuOpen.value;
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
  toggleShadowing: session.toggleShadowingMode,
  previousSentence: session.beforeSentence,
  nextSentence: session.nextSentence,
  previousLesson: session.prev,
  nextLesson: session.next,
  adjustPlaybackRate: delta => session.setPlaybackRate(currentPlaybackRate.value + delta),
  resetPlaybackRate: () => session.setPlaybackRate(1),
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

onMounted(() => {
  session.start();
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keydown', playbackShortcut.keydown, true);
  window.addEventListener('keydown', recordingRestartShortcut, true);
  window.addEventListener('keyup', playbackShortcut.keyup, true);
  window.addEventListener('blur', playbackShortcut.reset);
  window.addEventListener('pointerdown', handleScrollPointer);
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
});

onUnmounted(() => {
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
  session.dispose();
});
</script>

<style>
.lesson-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 2vh, 14px);
  text-align: center;
  max-width: 420px;
  width: 100%;
  margin: auto;
  padding: clamp(24px, 4vh, 40px) 28px;
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.lesson-empty .text-h6 {
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.lesson-empty .text-grey-7 {
  font-size: var(--text-body);
  line-height: 1.5;
  color: var(--ink-muted);
}

.lesson-empty > .q-icon {
  font-size: 36px !important;
  color: var(--ink-muted) !important;
}
</style>
