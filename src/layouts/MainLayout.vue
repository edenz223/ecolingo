<template>
  <q-layout view="hHh lpR fFf" class="app-shell" :class="{ 'windows-titlebar': isWindows }">
    <q-header v-if="!focusMode" class="glass-header">
      <div class="system-titlebar">
        <div class="titlebar-leading">
          <span class="app-brand">EcoLingo</span>
          <button type="button" class="titlebar-menu-btn" aria-label="打开文件夹" @click="openFolder">
            文件
          </button>
          <button type="button" class="titlebar-menu-btn" aria-label="查看键盘快捷键" @click="showShortcuts = true">
            帮助
          </button>
        </div>
      </div>
      <div class="lesson-heading">
        <div v-if="player.parsedSentences.value.length" class="lesson-progress">
          <div class="ellipsis">{{ lessons[currentLessonIndex]?.name || player.currentLesson?.name }}</div>
          <span class="lesson-count">第 {{ Math.max(1, player.parsedSentences.value.indexOf(player.currentSentence.value) + 1) }} / {{ player.parsedSentences.value.length }} 句</span>
        </div>
        <q-btn v-if="!followSentence && player.parsedSentences.value.length" flat dense color="primary"
          icon="my_location" label="回到当前句" class="follow-btn" @click="resumeFollowing" />
        <q-btn flat round dense class="top-action top-sidebar-toggle" size="sm"
          aria-label="显示或隐藏课程列表" :aria-expanded="rightDrawerOpen"
          @click="toggleDrawer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M16 4v16" />
          </svg>
          <q-tooltip ref="drawerTooltipRef" :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">显示或隐藏课程列表</q-tooltip>
        </q-btn>
      </div>
    </q-header>

    <q-dialog v-model="showShortcuts">
      <q-card class="glass-dialog" style="width: 360px; max-width: 90vw">
        <q-card-section class="text-h6 q-pb-none">键盘快捷键</q-card-section>
        <q-card-section style="white-space: pre-line; line-height: 1.8; color: var(--ink);">
          空格：播放 / 暂停
          S：跟读开关
          A / D：上一句 / 下一句
          Q / E：上一课 / 下一课
          C / X：加速 / 减速
          Z：重置速度
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="关闭" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog :model-value="Boolean(recordingError)" persistent aria-labelledby="recording-error-title"
      aria-describedby="recording-error-message">
      <q-card class="glass-dialog" style="width: 420px; max-width: 90vw">
        <q-card-section id="recording-error-title" class="text-h6 text-negative">
          <q-icon name="warning" class="q-mr-sm" />录音提示
        </q-card-section>
        <q-card-section id="recording-error-message" class="q-pt-none">{{ recordingError }}</q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="关闭" autofocus @click="closeRecordingError" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-drawer v-if="!focusMode" v-model="rightDrawerOpen" show-if-above :breakpoint="900" side="right" class="glass-drawer">
      <q-scroll-area class="fit">
        <q-list>
          <q-item-label header>课程列表</q-item-label>
          <q-item v-for="(lesson, index) in lessons" :key="lesson.name" clickable @click="playLesson(index)"
            :class="{
              'lesson-item': true,
              'lesson-item--active': currentLessonIndex === index,
            }">
            <q-item-section>
              <q-item-label>{{ lesson.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <q-page-container>
      <q-page padding class="learning-page">
        <div v-if="!player.parsedSentences.value.length" class="lesson-empty">
          <q-icon name="headphones" size="48px" color="primary" />
          <div class="text-h6">{{ lessonLoading ? '正在打开课程…' : '开始今天的跟读' }}</div>
          <div class="text-grey-7">选择包含音频和字幕的文件夹</div>
          <q-btn unelevated color="primary" icon="folder_open" label="打开课程文件夹" :loading="lessonLoading" @click="openFolder" />
        </div>
        <div v-else-if="focusMode" class="zen-stage">
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(-1) }}</div>
          <Transition name="zen-sentence" mode="out-in">
            <div :key="player.currentSentence.value?.start" class="zen-current">{{ player.currentSentence.value?.text }}</div>
          </Transition>
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(1) }}</div>
        </div>
        <div v-else id="sentences" class="q-pa-md sentences-panel" @wheel.passive="pauseFollowing" @touchmove.passive="pauseFollowing">
          <q-list>
            <q-item v-for="s in player.parsedSentences.value" :key="s.start" clickable
              class="sentence-item" active-class="sentence-item--active"
              :class="{ 'sentence-preview': previewClipId && recordings[s.start]?.id === previewClipId }"
              @click="player.handleSentenceClick(s, $event)" @dblclick="player.doubleClickSentence(s)"
              :active="!previewClipId && player.currentSentence.value === s">
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
              </q-item-section>
              <q-item-section side class="sentence-actions">
                <q-btn v-if="recordings[s.start] && !isRecording && noSpeechSentence !== s.start" round dense flat
                  class="sentence-recording-button"
                  :icon="previewClipId === recordings[s.start].id ? 'stop_circle' : 'play_circle'"
                  :color="previewClipId === recordings[s.start].id ? 'primary' : undefined"
                  :aria-label="previewClipId === recordings[s.start].id ? '停止回放' : '播放此句最新录音'"
                  @click.stop="playUserRecording(s.start)">
                  <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">{{ previewClipId === recordings[s.start].id ? '停止回放' : '播放此句录音' }}</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-page>
    </q-page-container>

    <q-footer class="glass-footer">
      <Transition name="recording-float">
      <div v-if="isRecording || noSpeechSentence !== null" class="floating-recording" role="status"
        aria-live="polite" aria-atomic="true">
        <span class="recording-mic recording-mic--floating"
          :class="{
            'recording-mic--active': recordingVoiceActive && noSpeechSentence === null,
            'recording-mic--silent': noSpeechSentence !== null,
            'recording-mic--first': zenMode && zenPhase === 'first' && noSpeechSentence === null,
          }" aria-hidden="true">
          <q-icon :name="noSpeechSentence !== null ? 'mic_off' : 'mic'" size="26px" />
          <span v-if="recordingVoiceActive || noSpeechSentence !== null"
            :key="noSpeechSentence !== null ? 'silent' : 'voice'" class="recording-particles">
            <span v-for="particle in 8" :key="particle" class="recording-particle"
              :style="{
                '--particle-angle': `${particle * 45}deg`,
                '--particle-delay': `${(particle % 4) * 90}ms`,
              }" />
          </span>
        </span>
        <span class="sr-only">{{ noSpeechSentence !== null ? '未检测到声音，已暂停' : zenMode && zenPhase === 'first' ? '首次尝试，录音不保存' : '正在录音' }}</span>
      </div>
      </Transition>
      <div v-if="zenPhase === 'reference' || zenPhase === 'preview'" class="floating-phase"
        role="status" :aria-label="zenPhase === 'reference' ? '正在播放原声' : '正在回听自己的录音'">
        <q-icon :name="zenPhase === 'reference' ? 'headphones' : 'record_voice_over'" size="24px" />
      </div>
      <q-toolbar class="wrap playback-toolbar">
        <div class="sentence-navigation">
        <q-btn flat round class="transport-button" icon="skip_previous" aria-label="上一句" :disable="!player.currentSentence.value" @click="beforeSentence">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">上一句 · A</q-tooltip>
        </q-btn>
        <q-btn round unelevated color="primary" size="lg" class="primary-play" :disable="!player.currentSentence.value"
          :aria-label="player.isShadowing.value || (player.sound.value && player.sound.value.playing()) ? '暂停' : '播放'"
          :icon="player.isShadowing.value || (player.sound.value && player.sound.value.playing())
          ? 'pause'
          : 'play_arrow'
          " @click="togglePlay">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">{{
            player.isShadowing.value || (player.sound.value && player.sound.value.playing())
              ? "暂停"
              : "播放"
          }} · 空格</q-tooltip>
        </q-btn>
        <q-btn flat round class="transport-button" icon="skip_next" aria-label="下一句" :disable="!player.currentSentence.value" @click="nextSentence">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">下一句 · D</q-tooltip>
        </q-btn>
        </div>

        <div class="practice-controls">

          <button type="button" class="ios-switch-control" role="switch" :aria-checked="shadowingMode"
            :disabled="!player.sound.value" @click="toggleShadowingMode">
            <span class="ios-switch" aria-hidden="true"><span class="ios-switch__thumb" /></span>
            <span>跟读</span>
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">{{ shadowingMode ? '关闭跟读' : '开启跟读' }} · S</q-tooltip>
          </button>
          <q-btn v-if="shadowingMode" flat no-caps :label="'练习方式：' + practiceMethods.find(method => method.id === practiceMethod).label"
            class="glass-action" icon-right="expand_more" aria-label="选择练习方式">
            <q-menu class="practice-menu" anchor="top right" self="bottom right">
              <q-list>
                <q-item-label header>选择接下来的练习流程</q-item-label>
                <q-item v-for="method in practiceMethods" :key="method.id" clickable v-close-popup
                  :active="practiceMethod === method.id" @click="selectPracticeMethod(method.id)">
                  <q-item-section>
                    <q-item-label>{{ method.label }}</q-item-label>
                    <q-item-label caption>{{ method.flow }}</q-item-label>
                  </q-item-section>
                  <q-item-section side><q-icon v-if="practiceMethod === method.id" name="check" /></q-item-section>
                </q-item>
                <q-item-label caption class="q-pa-md">首次尝试不保存，正式跟读自动保存在本地。选择方式后按播放开始。</q-item-label>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="playback-options">
        <q-btn flat round :icon="focusMode ? 'fullscreen_exit' : 'fullscreen'" :aria-label="focusMode ? '退出专注显示' : '专注显示'"
          :aria-pressed="focusMode" :disable="!player.currentSentence.value" @click="toggleFocusMode">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100">{{ focusMode ? '退出专注显示' : '专注显示' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="player.repeatOne.value ? 'repeat_one' : 'repeat'"
          :color="player.repeatOne.value ? 'light-blue-4' : undefined" :disable="!player.sound.value"
          :aria-label="player.repeatOne.value ? '关闭单句循环' : '开启单句循环'" :aria-pressed="player.repeatOne.value"
          @click="player.repeatOne.value = !player.repeatOne.value">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip">{{
            player.repeatOne.value ? '关闭单句循环' : '开启单句循环'
            }}</q-tooltip>
        </q-btn>

        <!-- Add this new button for playback rate control -->
          <q-btn flat dense :label="currentPlaybackRate + 'x'" class="playback-rate-control" aria-label="播放速度" :disable="!player.sound.value">
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100">播放速度 · C / X 调整，Z 重置</q-tooltip>
          <q-menu v-model="playbackRateMenuVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
            class="q-pa-sm">
            <q-list dense>
              <q-item v-for="rate in playbackRates" :key="rate" clickable v-close-popup :active="Number(currentPlaybackRate) === rate" @click="setPlaybackRate(rate)">
                <q-item-section>{{ rate }} 倍</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, ref, onUnmounted, watch } from "vue";
import { Player } from '../modules/player';
import { RecorderManager } from '../modules/recorder';
import { ZenCoordinator, practiceMethods } from '../modules/zen';
import { loadSettings, saveSettings } from '../utils/settings';

const settings = loadSettings();
const isWindows = window.fileAPI?.platform === 'win32';
const showShortcuts = ref(false);
const rightDrawerOpen = ref(settings.drawerOpen);
const drawerTooltipRef = ref(null);

function toggleDrawer() {
  drawerTooltipRef.value?.hide();
  rightDrawerOpen.value = !rightDrawerOpen.value;
}
const lessons = ref([]);
const currentLessonIndex = ref(-1);
const followSentence = ref(true);
const lessonLoading = ref(false);

const shadowingMode = ref(settings.shadowing);
const focusMode = ref(false);
const playbackRateMenuVisible = ref(false);
const currentPlaybackRate = ref(settings.playbackRate);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5];

const player = new Player({
  playbackRate: currentPlaybackRate,
  repeatOne: ref(settings.repeatOne),
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

const isRecording = recorder.isRecording;
const recordingError = recorder.recordingError;
const recordingVoiceActive = recorder.recordingVoiceActive;
const recordingStatus = recorder.recordingStatus;
const recordings = recorder.recordings;
const noSpeechSentence = recorder.noSpeechSentence;
const previewClipId = recorder.previewClipId;
const pendingSaves = recorder.pendingSaves;

recorder.setCallbacks({
  isShadowingActive: () => player.isShadowing.value,
  isShadowingModeActive: () => shadowingMode.value,
  getLoadSessionId: () => player.loadSessionId,
  getCurrentSentence: () => player.currentSentence.value,
  seekSentence: (start) => player.sound.value?.seek(start),
  stopPlayback: () => player.stopCurrentPlayback(),
  advanceSentence: () => {
    player.isShadowing.value = false;
    player.advanceSentence();
  },
  onRecordingComplete: (completion, meta, blob) => {
    zen.completeZenRecording(completion, meta, blob);
  },
});

player.setCallbacks({
  onLoadingChange: (loading) => {
    lessonLoading.value = loading;
  },
  onError: (msg) => {
    recorder.recordingError.value = msg;
  },
  onSentenceChange: (sentence) => {
    if (focusMode.value || !followSentence.value || !sentence) return;
    const element = document.getElementById(sentence.start.toString());
    element?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  },
  onSentenceBoundary: (sentence) => {
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
  onPlayLessonStart: async (lesson, sessionId) => {
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
  handleZenClick: (sentence, forcePlay, wasPlayingZenReference) => {
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

function selectPracticeMethod(method) {
  playbackRateMenuVisible.value = false;
  zen.selectPracticeMethod(method);
}

function toggleFocusMode() {
  playbackRateMenuVisible.value = false;
  focusMode.value = !focusMode.value;
}

watch(focusMode, (val) => {
  window.fileAPI?.setFocusMode?.(val);
});

function zenNeighbor(offset) {
  const sentences = player.parsedSentences;
  return sentences.value[sentences.value.indexOf(player.currentSentence.value) + offset]?.text || '';
}

function closeRecordingError() {
  recorder.closeRecordingError();
}

function pauseFollowing() {
  followSentence.value = false;
}

function resumeFollowing() {
  followSentence.value = true;
  player.handleSentenceChange(player.currentSentence.value);
}

function handleScrollPointer(event) {
  if (event.clientX >= document.documentElement.clientWidth) pauseFollowing();
}

function handleKeyDown(event) {
  if (event.code === 'Escape' && focusMode.value) {
    focusMode.value = false;
    return;
  }
  if (recordingError.value || event.target.closest('input, textarea, select, button, [role="switch"], [role="slider"], [contenteditable="true"]') || event.altKey || event.metaKey) return;
  if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.code)) pauseFollowing();
  if (!player.sound.value && !['KeyQ', 'KeyE', 'KeyR'].includes(event.code)) return;
  if (event.ctrlKey && event.code !== 'KeyR') return;
  if (!['Space', 'KeyS', 'KeyD', 'KeyA', 'KeyQ', 'KeyE', 'KeyC', 'KeyX', 'KeyZ', 'KeyR'].includes(event.code)) return;
  if (event.code === 'KeyR' && !event.ctrlKey) return;
  event.preventDefault();
  if (event.code === 'Space' && !event.target.closest('input, textarea')) {
    togglePlay();
  }
  if (event.code === 'KeyS' && !event.target.closest('input, textarea')) {
    toggleShadowingMode();
  }
  if (event.code === 'KeyD' && !event.target.closest('input, textarea')) {
    nextSentence();
  }
  if (event.code === 'KeyA' && !event.target.closest('input, textarea')) {
    beforeSentence();
  }
  if (event.code === 'KeyQ' && !event.target.closest('input, textarea')) {
    prev();
  }
  if (event.code === 'KeyE' && !event.target.closest('input, textarea')) {
    next();
  }
  if (event.code === 'KeyC' && !event.target.closest('input, textarea')) {
    setPlaybackRate((parseFloat(currentPlaybackRate.value) + 0.1).toFixed(2));
  }
  if (event.code === 'KeyX' && !event.target.closest('input, textarea')) {
    setPlaybackRate((parseFloat(currentPlaybackRate.value) - 0.1).toFixed(2));
  }
  if (event.code === 'KeyZ' && !event.target.closest('input, textarea')) {
    setPlaybackRate(1);
  }
  if (event.code === 'KeyR' && event.ctrlKey) {
    location.reload();
  }
}

function handleGlobalPointerDown(e) {
  const target = e.target?.closest?.('button, .q-btn, [role="button"], [role="switch"]');
  if (target) {
    target.dispatchEvent(new MouseEvent('mouseleave'));
  }
}

onMounted(() => {
  loadLocalLessons();

  window.fileAPI?.onFolderSelected((event, values) => {
    handleOpenFolderResult(values);
  });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('pointerdown', handleScrollPointer);
  window.addEventListener('pointerdown', handleGlobalPointerDown, true);
});

onUnmounted(() => {
  if (focusMode.value) {
    window.fileAPI?.setFocusMode?.(false);
  }
  recorder.clearNoSpeechNotice();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('pointerdown', handleScrollPointer);
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  player.releaseLesson();
  recorder.releaseRecordingResources();
});

watch([currentPlaybackRate, shadowingMode, player.repeatOne, rightDrawerOpen, zenFirstAttempt, practiceMethod],
  ([playbackRate, shadowing, repeatOne, drawerOpen, zenFirstAttempt, practiceMethod]) => {
    saveSettings({ playbackRate, shadowing, repeatOne, drawerOpen, zenFirstAttempt, practiceMethod });
  }, { flush: 'sync' });

function playLesson(index) {
  if (index >= 0 && index < lessons.value.length) {
    currentLessonIndex.value = index;
    player.playLesson(lessons.value[index]);
  }
}

function togglePlay() {
  if (zenMode.value) {
    if (zenPhase.value !== 'idle') player.stopCurrentPlayback();
    else zen.startZenSentence();
    return;
  }
  recorder.stopPreview();
  if (player.sound.value?.playing() || player.isShadowing.value) {
    const sentence = player.currentSentence.value;
    const wasShadowing = player.isShadowing.value;
    player.stopCurrentPlayback();
    if (wasShadowing && sentence) player.sound.value?.seek(sentence.start);
  } else {
    player.sound.value?.play();
  }
}

function loadLocalLessons() {
  const localLessons = localStorage.getItem("lessons");
  if (localLessons) {
    lessons.value = JSON.parse(localLessons);
  }
}

function handleOpenFolderResult(values) {
  if (values && values.length > 0) {
    lessons.value = values;
    localStorage.setItem("lessons", JSON.stringify(values));
  }
}

function beforeSentence() {
  const idx = player.parsedSentences.value.indexOf(player.currentSentence.value);
  if (idx > 0) {
    if (player.currentPause) clearTimeout(player.currentPause);
    player.clickSentence(player.parsedSentences.value[idx - 1]);
  }
}

function nextSentence() {
  const idx = player.parsedSentences.value.indexOf(player.currentSentence.value);
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

function setPlaybackRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return;
  player.setPlaybackRate(Math.min(4, Math.max(0.1, value)));
}

function startSentenceRecording(sentence) {
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

function previewRecording(clip, onComplete = null) {
  return recorder.previewRecording(clip, onComplete);
}

function stopPreview() {
  recorder.stopPreview();
}

function playUserRecording(sentenceStart) {
  recorder.playUserRecording(sentenceStart);
}

function releaseRecordingResources() {
  recorder.releaseRecordingResources();
}
</script>
<style>
.zen-stage {
  width: 100%;
  max-width: 980px;
  box-sizing: border-box;
  min-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 48px;
  margin: auto;
  padding: 32px 24px 80px;
  text-align: center;
  overflow-wrap: anywhere;
  border: 1px solid var(--glass-border);
  border-radius: 32px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.17));
  box-shadow: var(--glass-shadow);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
  backdrop-filter: blur(18px) saturate(135%);
}
.zen-current {
  font-family: var(--font-display);
  font-size: clamp(28px, 4vw, 46px);
  line-height: 1.5;
  color: var(--ink-strong);
  font-weight: 500;
  letter-spacing: -0.015em;
}
.zen-neighbor {
  min-height: 2em;
  max-height: 3em;
  overflow: hidden;
  font-size: clamp(16px, 2vw, 22px);
  line-height: 1.5;
  opacity: 0.22;
  filter: blur(2px);
  pointer-events: none;
  user-select: none;
}
.zen-sentence-enter-active, .zen-sentence-leave-active {
  transition: opacity 160ms ease;
}
.zen-sentence-enter-from, .zen-sentence-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .zen-sentence-enter-active, .zen-sentence-leave-active { transition: none; }
}
.lesson-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(10px, 2vh, 16px);
  text-align: center;
  max-width: 480px;
  width: 100%;
  margin: auto;
  padding: clamp(26px, 4.5vh, 44px) 32px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.46), rgba(255, 255, 255, 0.24));
  border: 1px solid var(--glass-border);
  border-radius: 28px;
  box-shadow: var(--glass-shadow);
  -webkit-backdrop-filter: blur(22px) saturate(140%);
  backdrop-filter: blur(22px) saturate(140%);
}

.lesson-empty .text-h6 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.lesson-empty .text-grey-7 {
  font-size: 14px;
  line-height: 1.5;
}

.lesson-empty > .q-icon {
  display: grid;
  width: 66px;
  height: 66px;
  font-size: 40px !important;
  place-items: center;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  box-shadow: 0 12px 30px rgba(39, 119, 211, 0.12), inset 0 1px rgba(255, 255, 255, 0.82);
}

.lesson-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  height: 40px;
  padding: 0 16px;
  -webkit-app-region: no-drag;
}

.lesson-progress {
  display: flex;
  flex: 1;
  align-items: center;
  flex-wrap: nowrap;
  gap: 12px;
  min-width: 0;
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.lesson-progress .ellipsis {
  flex: 0 1 auto;
  max-width: min(50vw, 520px);
  min-width: 0;
}

.lesson-count {
  white-space: nowrap;
  color: var(--ink-muted);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.follow-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.lesson-heading > .top-sidebar-toggle {
  margin-left: auto;
  flex-shrink: 0;
}

.sentence-item.sentence-preview,
.sentence-preview {
  color: var(--active-ink);
  background: rgba(184, 220, 255, 0.32);
  border-color: var(--active-border);
  box-shadow: inset -3px 0 var(--accent), var(--active-shadow);
}

.sentences-panel {
  flex: 0 1 auto;
  max-height: 100%;
  margin: auto;
  max-width: 980px;
  width: 100%;
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
  backdrop-filter: blur(18px) saturate(135%);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sentences-panel::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.sentences-panel .q-list {
  display: grid;
  gap: 5px;
}

.sentence-item {
  min-height: 60px;
  color: var(--ink);
  font-size: 16px;
  line-height: 1.65;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.sentence-item:hover {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.65);
}

.sentence-item.sentence-item--active {
  color: var(--active-ink);
  background: var(--active-bg);
  border-color: var(--active-border);
  box-shadow: var(--active-shadow);
  font-weight: 600;
}

.sentence-item:focus-visible,
.lesson-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.playback-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 12px;
  padding: 10px 14px;
}

.sentence-navigation {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.34);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
}

.transport-button {
  color: var(--ink-strong);
  background: rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.46);
}

.primary-play {
  box-shadow: 0 10px 26px rgba(39, 119, 211, 0.28), inset 0 1px rgba(255, 255, 255, 0.42) !important;
}

.q-drawer {
  transition: box-shadow 0.2s;
}

.q-drawer--fixed {
  box-shadow: none !important;
}

.lesson-item {
  margin: 3px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: 14px;
  line-height: 1.45;
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
}

.lesson-item:hover {
  background: rgba(255, 255, 255, 0.32);
  border-color: rgba(255, 255, 255, 0.54);
}

.lesson-item--active {
  color: var(--active-ink) !important;
  background: var(--active-bg) !important;
  border-color: var(--active-border) !important;
  box-shadow: var(--active-shadow);
  font-weight: 600;
}

.small-tooltip {
  font-size: var(--text-caption);
}

.playback-rate-container {
  position: relative;
  display: inline-block;
}

.playback-rate-control {
  min-width: 50px;
}

.sentence-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 52px;
  width: 52px;
  min-height: 44px;
  padding-left: 12px;
  gap: 6px;
}

.sentence-recording-button {
  color: #2b6dab;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.66);
  box-shadow: 0 6px 18px rgba(39, 119, 211, 0.1), inset 0 1px rgba(255, 255, 255, 0.78);
}

.floating-recording {
  position: absolute;
  top: -82px;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  filter: drop-shadow(0 12px 22px rgba(35, 49, 65, 0.14));
  pointer-events: none;
  transform: translateX(-50%);
}

.practice-controls, .playback-options {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  min-height: 46px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.28);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.practice-controls { grid-column: 1; grid-row: 1; justify-self: start; }
.playback-options { grid-column: 3; grid-row: 1; justify-self: end; justify-content: flex-end; }
.practice-menu { width: 360px; max-width: 90vw; }

.practice-menu .q-item__label:not(.q-item__label--caption) {
  font-size: 14px;
  font-weight: 500;
}

.ios-switch-control {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 4px 10px 4px 6px;
  color: var(--ink-strong);
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 12px;
}

.ios-switch-control:hover {
  background: rgba(255, 255, 255, 0.38);
}

.ios-switch-control:disabled {
  cursor: default;
  opacity: 0.42;
}

.ios-switch {
  position: relative;
  width: 38px;
  height: 22px;
  background: rgba(69, 85, 103, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: 999px;
  box-shadow: inset 0 1px 3px rgba(36, 55, 74, 0.14);
  transition: background-color 180ms ease;
}

.ios-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.96);
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(28, 48, 68, 0.28);
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ios-switch-control[aria-checked='true'] .ios-switch {
  background: linear-gradient(145deg, #64b3fb, #2d80dc);
}

.ios-switch-control[aria-checked='true'] .ios-switch__thumb {
  transform: translateX(16px);
}
.floating-phase {
  position: absolute;
  bottom: calc(100% + 28px);
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  width: 60px;
  height: 60px;
  place-items: center;
  padding: 0;
  color: #426986;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.76), rgba(221, 238, 250, 0.54));
  border: 1px solid var(--glass-border);
  box-shadow: 0 12px 28px rgba(35, 49, 65, 0.13), inset 0 1px rgba(255, 255, 255, 0.9);
  -webkit-backdrop-filter: blur(18px) saturate(145%);
  backdrop-filter: blur(18px) saturate(145%);
  border-radius: 50%;
  pointer-events: none;
}
@media (max-width: 850px) {
  .playback-toolbar { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
  .practice-controls { min-width: 0; }
  .sentence-navigation { grid-column: 1 / -1; justify-self: center; }
  .practice-controls { grid-column: 1 / 3; grid-row: 2; }
  .playback-options { grid-column: 3; grid-row: 2; }
}

.recording-float-enter-active,
.recording-float-leave-active {
  transition: opacity 200ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.recording-float-enter-from,
.recording-float-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px) scale(0.92);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.recording-mic {
  --recording-accent: #c95060;
  --recording-rgb: 201, 80, 96;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--recording-accent);
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.88), rgba(var(--recording-rgb), 0.16));
  border: 1px solid rgba(255, 255, 255, 0.84);
  box-shadow: 0 10px 26px rgba(var(--recording-rgb), 0.18), inset 0 1px rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  backdrop-filter: blur(18px) saturate(150%);
  transition: color 240ms ease, background 240ms ease, box-shadow 240ms ease;
}

.recording-mic--floating {
  width: 60px;
  height: 60px;
}

.recording-mic::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid currentColor;
  border-radius: inherit;
  opacity: 0.12;
  animation: recording-breathe 2.4s ease-in-out infinite;
}

.recording-mic > .q-icon {
  z-index: 1;
}

.recording-mic--active {
  --recording-accent: #208e69;
  --recording-rgb: 32, 142, 105;
}

.recording-mic--active::before {
  animation: recording-ripple 1.8s ease-out infinite;
}

.recording-mic--first {
  --recording-accent: #7951ab;
  --recording-rgb: 121, 81, 171;
}

.recording-mic--first::before {
  border: 2px dashed currentColor;
}

.recording-mic--first.recording-mic--active {
  --recording-accent: #6840a0;
  --recording-rgb: 104, 64, 160;
}

.recording-particles {
  position: absolute;
  inset: 0;
  color: inherit;
  pointer-events: none;
}

.recording-particle {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0;
  animation: recording-particle-diffuse 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  animation-delay: var(--particle-delay);
}

.recording-mic--silent {
  --recording-accent: #a8731c;
  --recording-rgb: 168, 115, 28;
}

.recording-mic--silent::before {
  animation: recording-ripple 900ms ease-out both;
}

.recording-mic--silent .recording-particle {
  animation-duration: 720ms;
  animation-delay: 0ms;
  animation-iteration-count: 1;
  animation-fill-mode: both;
}

@keyframes recording-breathe {
  0%, 100% { opacity: 0.10; transform: scale(1); }
  50% { opacity: 0.24; transform: scale(1.06); }
}

@keyframes recording-ripple {
  0% { opacity: 0.26; transform: scale(0.96); }
  100% { opacity: 0; transform: scale(1.48); }
}

@keyframes recording-particle-diffuse {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--particle-angle)) translateY(-25px) scale(0.65);
  }
  20% {
    opacity: 0.48;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--particle-angle)) translateY(-41px) scale(0.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .recording-particle,
  .recording-mic::before {
    animation: none;
  }

  .recording-mic,
  .ios-switch,
  .ios-switch__thumb,
  .recording-float-enter-active,
  .recording-float-leave-active {
    transition: none;
  }
}

</style>
