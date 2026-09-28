<template>
  <q-layout
    view="hHh lpR fFf"
    class="app-shell"
    :class="{ 'windows-titlebar': isWindows, 'app-shell--focus': focusMode }"
  >
    <q-header v-if="!focusMode" class="glass-header">
      <div class="system-titlebar" @dblclick="toggleMaximize">
        <div class="titlebar-leading">
          <span class="app-brand">EcoLingo</span>
          <button
            type="button"
            class="titlebar-menu-btn"
            aria-label="打开文件夹"
            @click.stop="openFolder"
          >
            文件
          </button>
          <button
            type="button"
            class="titlebar-menu-btn"
            aria-label="查看键盘快捷键"
            @click.stop="showShortcuts = true"
          >
            帮助
          </button>
        </div>
        <div v-if="!isMac" class="window-controls">
          <button
            type="button"
            class="window-control-btn"
            aria-label="最小化"
            @click.stop="minimizeWindow"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            class="window-control-btn"
            :aria-label="isMaximized ? '还原' : '最大化'"
            @click.stop="toggleMaximize"
          >
            <svg
              v-if="isMaximized"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <path d="M2.5 1.5h6v6m-6 0v-6h6v6h-6z" />
            </svg>
            <svg
              v-else
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
          <button
            type="button"
            class="window-control-btn window-control-btn--close"
            aria-label="关闭"
            @click.stop="closeWindow"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
        </div>
      </div>
      <div class="lesson-heading">
        <div v-if="player.parsedSentences.value.length" class="lesson-progress">
          <div class="ellipsis">
            {{ lessons[currentLessonIndex]?.name || player.currentLesson?.name }}
          </div>
          <span class="lesson-count"
            >第
            {{
              Math.max(1, player.parsedSentences.value.indexOf(player.currentSentence.value) + 1)
            }}
            / {{ player.parsedSentences.value.length }} 句</span
          >
        </div>
        <q-btn
          v-if="!followSentence && player.parsedSentences.value.length"
          flat
          dense
          color="primary"
          icon="my_location"
          label="回到当前句"
          class="follow-btn"
          @click="resumeFollowing"
        />
        <q-btn
          flat
          round
          dense
          class="top-action top-sidebar-toggle"
          size="sm"
          aria-label="显示或隐藏课程列表"
          :aria-expanded="rightDrawerOpen"
          @click="toggleDrawer"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M16 4v16" />
          </svg>
          <q-tooltip
            ref="drawerTooltipRef"
            :delay="400"
            :hide-delay="0"
            :transition-duration="100"
            class="small-tooltip"
            >显示或隐藏课程列表</q-tooltip
          >
        </q-btn>
      </div>
    </q-header>

    <q-dialog v-model="showShortcuts">
      <q-card class="glass-dialog" style="width: 360px; max-width: 90vw">
        <q-card-section class="text-h6 q-pb-none">键盘快捷键</q-card-section>
        <q-card-section style="white-space: pre-line; line-height: 1.8; color: var(--ink)">
          空格：播放 / 暂停 S：跟读开关 A / D：上一句 / 下一句 Q / E：上一课 / 下一课 C / X：加速 /
          减速 Z：重置速度 R：跳过播放 / 重新录制
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="关闭" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog
      :model-value="Boolean(recordingError)"
      persistent
      aria-labelledby="recording-error-title"
      aria-describedby="recording-error-message"
    >
      <q-card class="glass-dialog" style="width: 420px; max-width: 90vw">
        <q-card-section id="recording-error-title" class="text-h6 text-negative">
          <q-icon name="warning" class="q-mr-sm" />录音提示
        </q-card-section>
        <q-card-section id="recording-error-message" class="q-pt-none">{{
          recordingError
        }}</q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="关闭" autofocus @click="closeRecordingError" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-drawer
      v-if="!focusMode"
      v-model="rightDrawerOpen"
      show-if-above
      :breakpoint="900"
      side="right"
      class="glass-drawer"
    >
      <q-scroll-area class="fit">
        <q-list>
          <q-item-label header>课程列表</q-item-label>
          <q-item
            v-for="(lesson, index) in lessons"
            :key="lesson.name"
            clickable
            @click="playLesson(index)"
            :class="{
              'lesson-item': true,
              'lesson-item--active': currentLessonIndex === index,
            }"
          >
            <q-item-section>
              <q-item-label>{{ lesson.name }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

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
            @click="openFolder"
          />
        </div>
        <div v-else-if="focusMode" class="zen-stage">
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(-1) }}</div>
          <Transition name="zen-sentence" mode="out-in">
            <div :key="player.currentSentence.value?.start" class="zen-current">
              {{ player.currentSentence.value?.text }}
            </div>
          </Transition>
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(1) }}</div>
        </div>
        <div
          v-else
          id="sentences"
          class="q-pa-md sentences-panel"
          @wheel.passive="pauseFollowing"
          @touchmove.passive="pauseFollowing"
        >
          <q-list>
            <q-item
              v-for="s in player.parsedSentences.value"
              :key="s.start"
              clickable
              class="sentence-item"
              active-class="sentence-item--active"
              :class="{
                'sentence-preview': previewClipId && recordings[s.start]?.id === previewClipId,
              }"
              @click="player.handleSentenceClick(s, $event)"
              @dblclick="player.doubleClickSentence(s)"
              :active="!previewClipId && player.currentSentence.value === s"
            >
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
              </q-item-section>
              <q-item-section side class="sentence-actions">
                <q-btn
                  v-if="recordings[s.start] && !isRecording && noSpeechSentence !== s.start"
                  round
                  dense
                  flat
                  class="sentence-recording-button"
                  :icon="previewClipId === recordings[s.start].id ? 'stop_circle' : 'play_circle'"
                  :color="previewClipId === recordings[s.start].id ? 'primary' : undefined"
                  :aria-label="
                    previewClipId === recordings[s.start].id ? '停止回放' : '播放此句最新录音'
                  "
                  @click.stop="playUserRecording(s.start)"
                >
                  <q-tooltip
                    :delay="400"
                    :hide-delay="0"
                    :transition-duration="100"
                    class="small-tooltip"
                    >{{
                      previewClipId === recordings[s.start].id ? '停止回放' : '播放此句录音'
                    }}</q-tooltip
                  >
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-page>
    </q-page-container>

    <q-footer
      class="glass-footer"
      :class="{
        'focus-footer': focusMode,
        'controls-menu-open': playbackRateMenuVisible || practiceMenuVisible || loopMenuVisible,
      }"
    >
      <div class="sr-only" role="status" aria-live="polite">
        {{ isRecording ? '正在录音' : '' }}
      </div>
      <Transition name="focus-recording">
        <q-btn
          v-if="focusMode && isRecording"
          round
          unelevated
          size="lg"
          class="focus-recording-btn primary-play primary-play--recording"
          aria-label="正在录音，点击停止"
          @click="togglePlay"
        >
          <span
            :key="recordingRevision"
            class="recording-waveform"
            :class="{
              'recording-waveform--voice': recordingVoiceActive,
              'recording-waveform--restart': recordingRevision > 0,
            }"
            aria-hidden="true"
          >
            <span class="waveform-bar waveform-bar--1" />
            <span class="waveform-bar waveform-bar--2" />
            <span class="waveform-bar waveform-bar--3" />
          </span>
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >录音中 · 空格停止 · R 重录</q-tooltip
          >
        </q-btn>
      </Transition>
      <q-toolbar class="wrap playback-toolbar">
        <div class="sentence-navigation">
          <q-btn
            flat
            round
            class="transport-button"
            icon="skip_previous"
            aria-label="上一句"
            :disable="!player.currentSentence.value"
            @click="beforeSentence"
          >
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
              >上一句 · A</q-tooltip
            >
          </q-btn>
          <q-btn
            round
            unelevated
            :color="isRecording ? undefined : 'primary'"
            size="lg"
            class="primary-play"
            :class="{ 'primary-play--recording': isRecording }"
            :disable="!player.currentSentence.value"
            :aria-label="
              isRecording
                ? '正在录音，点击停止'
                : player.isShadowing.value || (player.sound.value && player.sound.value.playing())
                ? '暂停'
                : '播放'
            "
            :icon="
              isRecording
                ? undefined
                : player.isShadowing.value || (player.sound.value && player.sound.value.playing())
                ? 'pause'
                : 'play_arrow'
            "
            @click="togglePlay"
          >
            <span
              v-if="isRecording"
              :key="recordingRevision"
              class="recording-waveform"
              :class="{
                'recording-waveform--voice': recordingVoiceActive,
                'recording-waveform--restart': recordingRevision > 0,
              }"
              aria-hidden="true"
            >
              <span class="waveform-bar waveform-bar--1" />
              <span class="waveform-bar waveform-bar--2" />
              <span class="waveform-bar waveform-bar--3" />
            </span>
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
              >{{
                isRecording
                  ? '录音中，R 重录'
                  : player.isShadowing.value || (player.sound.value && player.sound.value.playing())
                  ? '暂停'
                  : '播放'
              }}
              · 空格</q-tooltip
            >
          </q-btn>
          <q-btn
            flat
            round
            class="transport-button"
            icon="skip_next"
            aria-label="下一句"
            :disable="!player.currentSentence.value"
            @click="nextSentence"
          >
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
              >下一句 · D</q-tooltip
            >
          </q-btn>
        </div>

        <div class="practice-controls">
          <button
            type="button"
            class="ios-switch-control"
            role="switch"
            aria-label="跟读"
            :aria-checked="shadowingMode"
            :disabled="!player.sound.value"
            @click="toggleShadowingMode"
          >
            <span class="ios-switch" aria-hidden="true"><span class="ios-switch__thumb" /></span>
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
              >{{ shadowingMode ? '关闭跟读' : '开启跟读' }} · S</q-tooltip
            >
          </button>
          <span v-if="!shadowingMode" class="practice-label">跟读</span>
          <q-btn
            v-if="shadowingMode"
            flat
            dense
            no-caps
            label="跟读"
            icon-right="expand_less"
            class="practice-method-btn"
            :disable="!player.sound.value"
            aria-label="跟读：选择练习方式"
            aria-haspopup="menu"
            :aria-expanded="practiceMenuVisible"
          >
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
              >练习方式：{{
                practiceMethods.find(method => method.id === practiceMethod)?.label ||
                '选择练习方式'
              }}</q-tooltip
            >
            <q-menu
              v-model="practiceMenuVisible"
              :no-refocus="pointerInteraction"
              class="practice-menu"
              anchor="top left"
              self="bottom left"
            >
              <q-list dense>
                <q-item-label header>练习方式</q-item-label>
                <q-item
                  v-for="method in practiceMethods"
                  :key="method.id"
                  clickable
                  v-close-popup
                  :active="practiceMethod === method.id"
                  @click="selectPracticeMethod(method.id)"
                >
                  <q-item-section>
                    <q-item-label>{{ method.label }}</q-item-label>
                  </q-item-section>
                  <q-item-section side
                    ><q-icon v-if="practiceMethod === method.id" name="check"
                  /></q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
        <div class="playback-options">
          <q-btn
            flat
            round
            :icon="focusMode ? 'fullscreen_exit' : 'fullscreen'"
            :aria-label="focusMode ? '退出专注显示' : '专注显示'"
            :aria-pressed="focusMode"
            :disable="!player.currentSentence.value"
            @click="toggleFocusMode"
          >
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100">{{
              focusMode ? '退出专注显示' : '专注显示'
            }}</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            class="loop-mode-control"
            :icon="player.loopMode.value === 'one' ? 'repeat_one' : 'repeat'"
            :color="player.loopMode.value !== 'off' ? 'primary' : undefined"
            :disable="!player.sound.value"
            :aria-label="
              '循环模式：' +
              (player.loopMode.value === 'one'
                ? '单句循环' + player.repeatCount.value + '次'
                : loopModes.find(item => item.id === player.loopMode.value)?.label)
            "
          >
            <q-menu v-model="loopMenuVisible" :no-refocus="pointerInteraction">
              <q-list>
                <q-item
                  v-for="mode in loopModes"
                  :key="mode.id"
                  clickable
                  v-close-popup
                  :active="player.loopMode.value === mode.id"
                  @click="player.setLoopMode(mode.id)"
                >
                  <q-item-section>
                    <div v-if="mode.id === 'one'" class="row items-center no-wrap">
                      <span>单句循环</span>
                      <input
                        aria-label="单句循环次数"
                        type="number"
                        min="1"
                        max="99"
                        step="1"
                        :value="player.repeatCount.value"
                        style="width: 3.5em; margin: 0 4px; color: inherit"
                        @click.stop
                        @keydown.stop
                        @change="changeRepeatCount"
                        @wheel.stop.prevent="scrollRepeatCount"
                      />
                      <span>次</span>
                    </div>
                    <template v-else>{{ mode.label }}</template>
                  </q-item-section>
                  <q-item-section side v-if="player.loopMode.value === mode.id"
                    ><q-icon name="check"
                  /></q-item-section>
                </q-item>
              </q-list>
            </q-menu>
            <q-tooltip>循环模式</q-tooltip>
          </q-btn>

          <!-- Add this new button for playback rate control -->
          <q-btn
            flat
            dense
            :label="currentPlaybackRate + 'x'"
            class="playback-rate-control"
            aria-label="播放速度"
            :disable="!player.sound.value"
          >
            <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100"
              >播放速度 · C / X 调整，Z 重置</q-tooltip
            >
            <q-menu
              v-model="playbackRateMenuVisible"
              :no-refocus="pointerInteraction"
              anchor="top right"
              self="bottom right"
              :offset="[10, 0]"
              class="q-pa-sm"
            >
              <q-list dense>
                <q-item
                  v-for="rate in playbackRates"
                  :key="rate"
                  clickable
                  v-close-popup
                  :active="Number(currentPlaybackRate) === rate"
                  @click="setPlaybackRate(rate)"
                >
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
<script setup lang="ts">
import { computed, onMounted, ref, onUnmounted, watch } from 'vue';
import { createPlaybackShortcut } from '../utils/playback-shortcut';
import { createRecordingRestartShortcut } from '../utils/recording-shortcut';
import type { QTooltip } from 'quasar';
import { Player } from '../modules/player';
import { RecorderManager } from '../modules/recorder';
import { ZenCoordinator, practiceMethods } from '../modules/zen';
import { loadSettings, saveSettings } from '../utils/settings';
import type { Lesson, RecordingClip } from '../types/recording';
import type { Sentence } from '../types/subtitles';
import type { PracticeMethod } from '../types/settings';

const loopModes = [
  { id: 'off', label: '顺序播放' },
  { id: 'list', label: '列表循环' },
  { id: 'one', label: '单句循环' },
] as const;
const settings = loadSettings();
const isWindows = window.fileAPI?.platform === 'win32';
const isMac = window.fileAPI?.platform === 'darwin';
const isMaximized = ref(false);

async function minimizeWindow() {
  await window.fileAPI?.minimize?.();
}

async function toggleMaximize() {
  const result = await window.fileAPI?.maximize?.();
  if (typeof result === 'boolean') {
    isMaximized.value = result;
  }
}

async function closeWindow() {
  await window.fileAPI?.close?.();
}

const showShortcuts = ref(false);
const rightDrawerOpen = ref(settings.drawerOpen);
const drawerTooltipRef = ref<InstanceType<typeof QTooltip> | null>(null);

function toggleDrawer() {
  drawerTooltipRef.value?.hide();
  rightDrawerOpen.value = !rightDrawerOpen.value;
}
const lessons = ref<Lesson[]>([]);
const currentLessonIndex = ref(-1);
const followSentence = ref(true);
const lessonLoading = ref(false);

const shadowingMode = ref(settings.shadowing);
const focusMode = ref(false);
const pointerInteraction = ref(false);
const playbackRateMenuVisible = ref(false);
const practiceMenuVisible = ref(false);
const loopMenuVisible = ref(false);
const currentPlaybackRate = ref(settings.playbackRate);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5];

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
const recordingRevision = recorder.recordingRevision;
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
    recorder.recordingError.value = msg;
  },
  onSentenceChange: (sentence: Sentence | null) => {
    if (focusMode.value || !followSentence.value || !sentence) return;
    const element = document.getElementById(sentence.start.toString());
    element?.scrollIntoView({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
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

function selectPracticeMethod(method: PracticeMethod) {
  practiceMenuVisible.value = false;
  playbackRateMenuVisible.value = false;
  zen.selectPracticeMethod(method);
}

function toggleFocusMode() {
  playbackRateMenuVisible.value = false;
  focusMode.value = !focusMode.value;
}

watch(focusMode, val => {
  window.fileAPI?.setFocusMode?.(val);
});

function zenNeighbor(offset: number): string {
  const sentences = player.parsedSentences;
  const current = player.currentSentence.value;
  if (!current) return '';
  return sentences.value[sentences.value.indexOf(current) + offset]?.text || '';
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

function handleScrollPointer(event: MouseEvent | PointerEvent) {
  if (event.clientX >= document.documentElement.clientWidth) pauseFollowing();
}

const playbackShortcut = createPlaybackShortcut({
  isBlocked: () =>
    Boolean(recordingError.value) ||
    showShortcuts.value ||
    practiceMenuVisible.value ||
    loopMenuVisible.value ||
    playbackRateMenuVisible.value,
  canPlay: () => Boolean(player.sound.value),
  togglePlay,
});

const recordingRestartShortcut = createRecordingRestartShortcut({
  canRecord: () =>
    isRecording.value || Boolean(player.sound.value?.playing()) || Boolean(previewClipId.value),
  isBlocked: () =>
    Boolean(recordingError.value) ||
    showShortcuts.value ||
    practiceMenuVisible.value ||
    loopMenuVisible.value ||
    playbackRateMenuVisible.value,
  restart: () => {
    zen.recordCurrentSentence();
  },
});

function handleKeyDown(event: KeyboardEvent) {
  pointerInteraction.value = false;
  if (event.code === 'Escape' && focusMode.value) {
    if (practiceMenuVisible.value) {
      practiceMenuVisible.value = false;
      return;
    }
    focusMode.value = false;
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    recordingError.value ||
    target?.closest(
      'input, textarea, select, button, [role="switch"], [role="slider"], [contenteditable="true"]'
    ) ||
    event.altKey ||
    event.metaKey
  )
    return;
  if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.code))
    pauseFollowing();
  if (!player.sound.value && !['KeyQ', 'KeyE', 'KeyR'].includes(event.code)) return;
  if (event.ctrlKey && event.code !== 'KeyR') return;
  if (
    !['KeyS', 'KeyD', 'KeyA', 'KeyQ', 'KeyE', 'KeyC', 'KeyX', 'KeyZ', 'KeyR'].includes(event.code)
  )
    return;
  if (event.code === 'KeyR' && !event.ctrlKey) return;
  event.preventDefault();
  if (event.code === 'KeyS' && !target?.closest('input, textarea')) {
    toggleShadowingMode();
  }
  if (event.code === 'KeyD' && !target?.closest('input, textarea')) {
    nextSentence();
  }
  if (event.code === 'KeyA' && !target?.closest('input, textarea')) {
    beforeSentence();
  }
  if (event.code === 'KeyQ' && !target?.closest('input, textarea')) {
    prev();
  }
  if (event.code === 'KeyE' && !target?.closest('input, textarea')) {
    next();
  }
  if (event.code === 'KeyC' && !target?.closest('input, textarea')) {
    setPlaybackRate((parseFloat(String(currentPlaybackRate.value)) + 0.1).toFixed(2));
  }
  if (event.code === 'KeyX' && !target?.closest('input, textarea')) {
    setPlaybackRate((parseFloat(String(currentPlaybackRate.value)) - 0.1).toFixed(2));
  }
  if (event.code === 'KeyZ' && !target?.closest('input, textarea')) {
    setPlaybackRate(1);
  }
  if (event.code === 'KeyR' && event.ctrlKey) {
    location.reload();
  }
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
  loadLocalLessons();

  window.fileAPI?.onFolderSelected((_event, values: Lesson[]) => {
    handleOpenFolderResult(values);
  });

  window.fileAPI?.isMaximized?.().then(val => {
    isMaximized.value = Boolean(val);
  });
  window.fileAPI?.onMaximizedChange?.((val: boolean) => {
    isMaximized.value = val;
  });

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
  recorder.clearNoSpeechNotice();
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keydown', playbackShortcut.keydown, true);
  window.removeEventListener('keydown', recordingRestartShortcut, true);
  window.removeEventListener('keyup', playbackShortcut.keyup, true);
  window.removeEventListener('blur', playbackShortcut.reset);
  window.removeEventListener('pointerdown', handleScrollPointer);
  window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
  player.releaseLesson();
  recorder.releaseRecordingResources();
});

watch(
  [
    currentPlaybackRate,
    shadowingMode,
    player.loopMode,
    player.repeatCount,
    rightDrawerOpen,
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

function changeRepeatCount(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.value.trim()) player.setRepeatCount(input.valueAsNumber);
  input.value = String(player.repeatCount.value);
}

function scrollRepeatCount(event: WheelEvent) {
  if (!event.deltaY) return;
  player.setRepeatCount(player.repeatCount.value + (event.deltaY < 0 ? 1 : -1));
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
  practiceMenuVisible.value = false;
  if (player.currentSentence.value) {
    player.sound.value.seek(player.currentSentence.value.start);
  }
}

function setPlaybackRate(rate: number | string) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return;
  player.setPlaybackRate(Math.min(4, Math.max(0.1, value)));
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
</script>
<style>
.zen-stage {
  width: 100%;
  height: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 40px;
  margin: 0;
  padding: 40px 60px;
  text-align: center;
  overflow-wrap: anywhere;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.zen-current {
  font-family: var(--font-display);
  font-size: clamp(34px, 4.6vw, 56px);
  max-width: min(1100px, 92vw);
  line-height: 1.55;
  color: var(--ink-strong);
  font-weight: 500;
  letter-spacing: -0.015em;
}
.zen-neighbor {
  min-height: 2em;
  max-height: 3.2em;
  max-width: min(900px, 88vw);
  overflow: hidden;
  font-size: clamp(17px, 2.2vw, 26px);
  line-height: 1.5;
  opacity: 0.4;
  filter: blur(2.5px);
  pointer-events: none;
  user-select: none;
}
.zen-sentence-enter-active,
.zen-sentence-leave-active {
  transition: opacity 150ms ease;
}
.zen-sentence-enter-from,
.zen-sentence-leave-to {
  opacity: 0;
}

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

.lesson-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  height: 36px;
  padding: 0 12px;
  -webkit-app-region: no-drag;
}

.lesson-progress {
  display: flex;
  flex: 1;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: var(--text-body);
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
  font-size: var(--text-caption);
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
  background: var(--active-bg);
  box-shadow: inset -2px 0 var(--accent);
}

.sentences-panel {
  flex: 0 1 auto;
  max-height: 100%;
  margin: auto;
  max-width: 980px;
  width: 100%;
  background: transparent;
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  border-top: none;
  border-bottom: none;
  border-radius: 0;
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
  gap: 2px;
}

.sentence-item {
  min-height: 52px;
  color: var(--ink);
  font-size: var(--text-sentence);
  line-height: 1.7;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  transition: background-color 120ms ease;
}

.sentence-item:hover {
  background: var(--bg-hover);
}

.sentence-item.sentence-item--active {
  color: var(--ink-strong);
  font-size: var(--text-sentence-active);
  background: var(--active-bg);
  font-weight: 600;
  box-shadow: inset 2px 0 var(--accent);
}

.sentence-item:focus-visible,
.lesson-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.playback-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  padding: 8px 12px;
}

.sentence-navigation {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
}

.transport-button {
  color: var(--ink);
}

.primary-play {
  border-radius: 50% !important;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  max-width: 48px !important;
  max-height: 48px !important;
  padding: 0 !important;
  aspect-ratio: 1 / 1 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: var(--shadow-sm) !important;
  flex-shrink: 0 !important;
}

.primary-play .q-btn__content {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.primary-play--recording {
  background-color: #de5555 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(222, 85, 85, 0.32) !important;
  transition: background-color 200ms ease, box-shadow 200ms ease;
}

.primary-play--recording:hover {
  background-color: #d14747 !important;
}

.primary-play--recording:active {
  background-color: #c43c3c !important;
}

.recording-waveform {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3.5px;
  height: 32px;
  pointer-events: none;
}

.recording-waveform--restart {
  animation: recording-restart 280ms ease-out;
}

@keyframes recording-restart {
  from {
    opacity: 0.4;
    transform: scaleY(0.65);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

.waveform-bar {
  display: block;
  background-color: #ffffff;
  border-radius: 999px;
  transform-origin: center;
  transition: height 120ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: height;
}

.waveform-bar--1,
.waveform-bar--3 {
  width: 3.5px;
  height: 7px;
}

.waveform-bar--2 {
  width: 4px;
  height: 9.5px;
}

.recording-waveform--voice .waveform-bar--1,
.recording-waveform--voice .waveform-bar--3 {
  height: 20px;
}

.recording-waveform--voice .waveform-bar--2 {
  height: 28px;
}

.focus-recording-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2010;
  transition: opacity 160ms ease;
}

.focus-recording-enter-active,
.focus-recording-leave-active {
  transition: opacity 200ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.focus-recording-enter-from,
.focus-recording-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.92);
}

.focus-recording-enter-to,
.focus-recording-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .recording-waveform--restart {
    animation: none;
  }
  .waveform-bar {
    transition: none !important;
  }
  .focus-recording-enter-active,
  .focus-recording-leave-active {
    transition: opacity 100ms ease !important;
    transform: translateX(-50%) !important;
  }
}

.practice-label {
  padding: 0 4px;
  color: var(--ink);
  font-size: var(--text-control);
  font-weight: 500;
}

.practice-method-btn {
  height: 28px;
  min-height: 28px;
  color: var(--ink);
  transition: color 120ms ease, background-color 120ms ease;
}

.practice-method-btn:hover {
  color: var(--ink-strong);
  background: var(--bg-hover);
}

.practice-method-btn .q-icon {
  font-size: 20px;
  margin-left: 2px;
  color: var(--ink-muted);
}

.q-drawer {
  transition: box-shadow 0.2s;
}

.q-drawer--fixed {
  box-shadow: none !important;
}

.lesson-item {
  margin: 1px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: var(--text-body);
  line-height: 1.45;
  transition: background-color 120ms ease;
}

.lesson-item:hover {
  background: var(--bg-hover);
}

.lesson-item--active {
  color: var(--active-ink) !important;
  background: var(--active-bg) !important;
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
  flex: 0 0 44px;
  width: 44px;
  min-height: 36px;
  padding-left: 8px;
  gap: 4px;
}

.sentence-recording-button {
  color: var(--ink-muted);
}

.sentence-recording-button:hover {
  color: var(--ink);
}

.practice-controls,
.playback-options {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  min-height: 40px;
  padding: 4px;
  overflow: hidden;
}
.practice-controls {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
}
.playback-options {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  justify-content: flex-end;
}
.practice-menu {
  width: 180px;
  max-width: 90vw;
}

.practice-menu .q-item__label:not(.q-item__label--caption) {
  font-size: var(--text-body);
  font-weight: 500;
}

.ios-switch-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 6px;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
}

.ios-switch-control:hover {
  background: var(--bg-hover);
}

.ios-switch-control:disabled {
  cursor: default;
  opacity: 0.4;
}

.ios-switch {
  position: relative;
  width: 38px;
  height: 22px;
  background: var(--bg-sunken);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  transition: background-color 150ms ease;
}

.ios-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ios-switch-control[aria-checked='true'] .ios-switch {
  background: var(--accent);
  border-color: var(--accent);
}

.ios-switch-control[aria-checked='true'] .ios-switch__thumb {
  transform: translateX(16px);
}

@media (max-width: 600px) {
  .loop-mode-control,
  .playback-rate-control {
    display: none;
  }
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
</style>
