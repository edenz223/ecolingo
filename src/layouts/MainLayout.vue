<template>
  <q-layout view="hHh lpR fFf" class="bg-grey-1">
    <q-header v-if="!focusMode" elevated class="bg-primary text-white">
      <q-toolbar class="wrap">
        <q-toolbar-title> Ecolingo </q-toolbar-title>
        <q-btn flat label="打开课程" icon="folder_open" @click="openFolder" />
        <q-btn flat label="录音记录" icon="library_music" @click="showRecordingHistory" :disable="storageBusy" />
        <q-btn flat label="更多" icon="more_horiz" :disable="storageBusy">
          <q-menu>
            <q-list style="min-width: 180px">
              <q-item clickable v-close-popup @click="exportRecordings">
                <q-item-section avatar><q-icon name="archive" /></q-item-section>
                <q-item-section>导出录音备份</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="exportMergedRecording" :disable="!Object.keys(recordings).length">
                <q-item-section avatar><q-icon name="audio_file" /></q-item-section>
                <q-item-section>导出本课合并音频</q-item-section>
              </q-item>
              <q-item clickable v-close-popup @click="restoreRecordings">
                <q-item-section avatar><q-icon name="restore" /></q-item-section>
                <q-item-section>恢复录音备份</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-dialog :model-value="Boolean(recordingError)" persistent aria-labelledby="recording-error-title"
      aria-describedby="recording-error-message">
      <q-card style="width: 420px; max-width: 90vw">
        <q-card-section id="recording-error-title" class="text-h6 text-negative">
          <q-icon name="warning" class="q-mr-sm" />录音提示
        </q-card-section>
        <q-card-section id="recording-error-message" class="q-pt-none">{{ recordingError }}</q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="关闭" autofocus @click="closeRecordingError" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="historyOpen" @hide="stopPreview">
      <q-card style="width: 720px; max-width: 90vw">
        <q-card-section class="text-h6">全部录音记录</q-card-section>
        <q-card-section class="q-pt-none">
          每次录音均保存在本地。备份包含全部录音和 SQLite 索引，恢复时合并并去重。
          原课程音频和字幕需另行保存；重新打开相同内容的课程即可关联录音。
        </q-card-section>
        <q-card-section style="max-height: 55vh" class="scroll">
          <div v-if="!recordingHistory.length">暂无录音</div>
          <q-list separator>
            <q-item v-for="clip in recordingHistory" :key="clip.id" :class="{ 'sentence-preview': previewClipId === clip.id }">
              <q-item-section>
                <q-item-label>{{ clip.lessonName }} · {{ clip.start.toFixed(2) }}s</q-item-label>
                <q-item-label>{{ clip.text }}</q-item-label>
                <q-item-label caption>{{ new Date(clip.createdAt).toLocaleString() }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn round flat :icon="previewClipId === clip.id ? 'stop_circle' : 'play_circle'"
                  :aria-label="previewClipId === clip.id ? '停止回放' : '播放录音'" @click="previewRecording(clip)" />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
        <q-card-actions align="right"><q-btn flat label="关闭" v-close-popup /></q-card-actions>
      </q-card>
    </q-dialog>

    <q-drawer v-if="!focusMode" v-model="rightDrawerOpen" show-if-above :breakpoint="500" side="right" bordered class="bg-white">
      <q-scroll-area class="fit">
        <q-list>
          <q-item-label header>课程列表</q-item-label>
          <q-item v-for="(lesson, index) in lessons" :key="lesson.name" clickable v-ripple @click="playLesson(index)"
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
      <q-page padding>
        <q-banner v-if="storageMessage" class="bg-blue-1 q-mb-md">{{ storageMessage }}</q-banner>
        <div v-if="!player.parsedSentences.value.length" class="lesson-empty">
          <q-icon name="headphones" size="48px" color="primary" />
          <div class="text-h6">{{ lessonLoading ? '正在打开课程…' : '开始今天的跟读' }}</div>
          <div class="text-grey-7">选择包含音频和字幕的文件夹</div>
          <q-btn unelevated color="primary" icon="folder_open" label="打开课程文件夹" :loading="lessonLoading" @click="openFolder" />
        </div>
        <div v-else-if="!focusMode" class="lesson-progress">
          <div class="ellipsis">{{ lessons[currentLessonIndex]?.name || player.currentLesson?.name }}</div>
          <span class="text-grey-7">第 {{ Math.max(1, player.parsedSentences.value.indexOf(player.currentSentence.value) + 1) }} / {{ player.parsedSentences.value.length }} 句</span>
          <q-btn v-if="!followSentence" flat dense color="primary" icon="my_location" label="回到当前句" @click="resumeFollowing" />
        </div>
        <div v-if="focusMode" class="zen-stage">
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(-1) }}</div>
          <Transition name="zen-sentence" mode="out-in">
            <div :key="player.currentSentence.value?.start" class="zen-current">{{ player.currentSentence.value?.text }}</div>
          </Transition>
          <div class="zen-neighbor" aria-hidden="true">{{ zenNeighbor(1) }}</div>
        </div>
        <div v-else id="sentences" class="q-pa-md" @wheel.passive="pauseFollowing" @touchmove.passive="pauseFollowing">
          <q-list separator>
            <q-item v-for="s in player.parsedSentences.value" :key="s.start" clickable v-ripple
              class="sentence-item" active-class="sentence-item--active"
              :class="{ 'sentence-preview': previewClipId && recordings[s.start]?.id === previewClipId }"
              @click="player.clickSentence(s)" :active="!previewClipId && player.currentSentence.value === s">
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
              </q-item-section>
              <q-item-section side class="sentence-actions">
                <q-btn v-if="recordings[s.start] && !isRecording && noSpeechSentence !== s.start" round dense flat
                  :icon="previewClipId === recordings[s.start].id ? 'stop_circle' : 'play_circle'"
                  :color="previewClipId === recordings[s.start].id ? 'primary' : undefined"
                  :aria-label="previewClipId === recordings[s.start].id ? '停止回放' : '播放此句最新录音'"
                  @click.stop="playUserRecording(s.start)">
                  <q-tooltip class="small-tooltip">{{ previewClipId === recordings[s.start].id ? '停止回放' : '播放此句录音' }}</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-page>
    </q-page-container>

    <q-footer elevated class="bg-grey-8 text-white">
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
        <q-btn flat round icon="skip_previous" aria-label="上一句" :disable="!player.currentSentence.value" @click="beforeSentence">
          <q-tooltip class="small-tooltip">上一句 · A</q-tooltip>
        </q-btn>
        <q-btn round unelevated color="primary" size="lg" :disable="!player.currentSentence.value"
          :aria-label="player.isShadowing.value || (player.sound.value && player.sound.value.playing()) ? '暂停' : '播放'"
          :icon="player.isShadowing.value || (player.sound.value && player.sound.value.playing())
          ? 'pause'
          : 'play_arrow'
          " @click="togglePlay">
          <q-tooltip class="small-tooltip">{{
            player.isShadowing.value || (player.sound.value && player.sound.value.playing())
              ? "暂停"
              : "播放"
          }} · 空格</q-tooltip>
        </q-btn>
        <q-btn flat round icon="skip_next" aria-label="下一句" :disable="!player.currentSentence.value" @click="nextSentence">
          <q-tooltip class="small-tooltip">下一句 · D</q-tooltip>
        </q-btn>
        </div>

        <div class="practice-controls">

          <q-btn flat dense icon="volume_up" class="volume-control" aria-label="音量" :disable="!player.sound.value">
            <q-tooltip>音量 · M 静音</q-tooltip>
            <q-menu v-model="volumeSliderVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
              class="q-pa-md">
              <q-slider v-model="volume" aria-label="音量" :min="0" :max="100" vertical reverse @change="updateVolume" class="no-border"
                style="height: 80px" />
            </q-menu>
          </q-btn>
          <q-toggle :model-value="shadowingMode" label="跟读" color="light-blue-4"
            :disable="!player.sound.value" @update:model-value="toggleShadowingMode">
            <q-tooltip class="small-tooltip">
              {{ shadowingMode ? '关闭跟读' : '开启跟读' }} · S
            </q-tooltip>
          </q-toggle>
          <q-btn v-if="shadowingMode" flat no-caps :label="'练习方式：' + practiceMethods.find(method => method.id === practiceMethod).label"
            icon-right="expand_more" aria-label="选择练习方式">
            <q-menu anchor="top right" self="bottom right">
              <q-list class="practice-menu">
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
          <q-tooltip>{{ focusMode ? '退出专注显示' : '专注显示' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="player.repeatOne.value ? 'repeat_one' : 'repeat'"
          :color="player.repeatOne.value ? 'light-blue-4' : undefined" :disable="!player.sound.value"
          :aria-label="player.repeatOne.value ? '关闭单句循环' : '开启单句循环'" :aria-pressed="player.repeatOne.value"
          @click="player.repeatOne.value = !player.repeatOne.value">
          <q-tooltip class="small-tooltip">{{
            player.repeatOne.value ? '关闭单句循环' : '开启单句循环'
            }}</q-tooltip>
        </q-btn>

        <!-- Add this new button for playback rate control -->
          <q-btn flat dense :label="currentPlaybackRate + 'x'" class="playback-rate-control" aria-label="播放速度" :disable="!player.sound.value">
          <q-tooltip>播放速度 · C / X 调整，Z 重置</q-tooltip>
          <q-menu v-model="playbackRateMenuVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
            class="q-pa-sm">
            <q-list dense>
              <q-item v-for="rate in playbackRates" :key="rate" clickable v-close-popup :active="Number(currentPlaybackRate) === rate" @click="setPlaybackRate(rate)">
                <q-item-section>{{ rate }} 倍</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
          </q-btn>
        <q-btn v-if="!focusMode" flat dense icon="queue_music" label="课程" aria-label="显示或隐藏课程列表"
          :aria-expanded="rightDrawerOpen" @click="rightDrawerOpen = !rightDrawerOpen">
          <q-tooltip class="small-tooltip">课程列表 · Q / E 切换课程</q-tooltip>
        </q-btn>
        </div>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, ref, onUnmounted, watch } from "vue";
import { parseLRC, parseSRT } from '../utils/lyrics-util';
import { Howl } from "howler";
import { mergeRecordings } from '../utils/recording-export';
import { createVoiceMonitor } from '../utils/voice-activity';
import { createZenCompletion } from '../utils/zen-flow';
import { loadSettings, saveSettings } from '../utils/settings';

const settings = loadSettings();
const rightDrawerOpen = ref(settings.drawerOpen);
const lessons = ref([]);
const currentLessonIndex = ref(-1);
const volume = ref(settings.volume);
const muted = ref(settings.muted);
const volumeSliderVisible = ref(false);
const followSentence = ref(true);
const lessonLoading = ref(false);

const shadowingMode = ref(settings.shadowing);
const zenMode = ref(settings.shadowing && settings.practiceMethod !== 'listen');
const focusMode = ref(false);
const practiceMethod = ref(settings.practiceMethod);
const practiceMethods = [
  { id: 'listen', label: '先听后读', flow: '听原声 → 跟读' },
  { id: 'replay', label: '听读回听', flow: '听原声 → 跟读 → 听自己' },
  { id: 'attempt', label: '先读再听', flow: '先尝试 → 听原声 → 再跟读 → 听自己' },
];

function selectPracticeMethod(method) {
  if (!shadowingMode.value || !player.sound.value || !practiceMethods.some(item => item.id === method)) return;
  player.stopCurrentPlayback();
  releaseRecordingResources();
  volumeSliderVisible.value = false;
  playbackRateMenuVisible.value = false;
  player.sound.value.seek(player.currentSentence.value.start);
  practiceMethod.value = method;
  zenMode.value = shadowingMode.value && method !== 'listen';
  zenFirstAttempt.value = method === 'attempt';
}

function toggleFocusMode() {
  volumeSliderVisible.value = false;
  playbackRateMenuVisible.value = false;
  focusMode.value = !focusMode.value;
}
const zenFirstAttempt = ref(settings.practiceMethod === 'attempt');
const zenPhase = ref('idle');
let zenSession = 0;

function zenNeighbor(offset) {
  const sentences = player.parsedSentences;
  return sentences.value[sentences.value.indexOf(player.currentSentence.value) + offset]?.text || '';
}

function startZenSentence() {
  if (!player.currentSentence.value) return;
  clearNoSpeechNotice();
  if (!zenFirstAttempt.value) {
    playZenReference(player.currentSentence.value);
    return;
  }
  zenPhase.value = 'first';
  player.isShadowing.value = true;
  player.sound.value.seek(player.currentSentence.value.start);
  startSentenceRecording(player.currentSentence.value);
}

function playZenReference(sentence) {
  zenPhase.value = 'reference';
  player.isShadowing.value = false;
  player.sound.value.seek(sentence.start);
  player.sound.value.play();
}

const completeZenRecording = createZenCompletion({
  isCurrent: (completion) => zenMode.value && completion.zenSession === zenSession &&
    completion.sessionId === player.loadSessionId && completion.sentence === player.currentSentence.value,
  playReference: playZenReference,
  setPhase: (phase) => { zenPhase.value = phase; },
  save: saveRecording,
  preview: previewRecording,
  advance: (sentence) => {
      const next = player.repeatOne.value ? sentence : player.getNextSentence();
      if (!next) {
        player.stopCurrentPlayback();
        releaseRecordingResources();
        return;
      }
      player.currentSentence.value = next;
      startZenSentence();
  },
  stop: () => player.stopCurrentPlayback(),
});
const recordings = ref({});
const isRecording = ref(false);
const recordingError = ref("");
let noSpeechNoticeTimer = null;
const noSpeechSentence = ref(null);

function clearNoSpeechNotice() {
  clearTimeout(noSpeechNoticeTimer);
  noSpeechNoticeTimer = null;
  noSpeechSentence.value = null;
}

function closeRecordingError() {
  recordingError.value = '';
}
let mediaRecorder = null;
let mediaStream = null;
let recordingChunks = [];
let voiceMonitor = null;
let recordingAttempt = 0;
let recordingStartedAt = 0;
let completedShadow = null;
const recordingStatus = ref('');
const recordingVoiceActive = ref(false);
let pendingRecordingSentence = null;
let recorderInitPromise = null;
let discardNextRecording = false;
let previewAudio = null;
let previewUrl = null;
let previewSession = 0;
const previewClipId = ref(null);
let activeLessonId = null;
let microphoneSession = 0;
const pendingSaves = new Set();
const storageBusy = ref(false);
const storageMessage = ref('');
const historyOpen = ref(false);
const recordingHistory = ref([]);

// Add these new refs and constants
const playbackRateMenuVisible = ref(false);
const currentPlaybackRate = ref(settings.playbackRate);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5];

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
  if (recordingError.value || historyOpen.value || storageBusy.value || event.target.closest('input, textarea, select, button, [role="switch"], [role="slider"], [contenteditable="true"]') || event.altKey || event.metaKey) return;
  if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.code)) pauseFollowing();
  if (!player.sound.value && !['KeyQ', 'KeyE', 'KeyR'].includes(event.code)) return;
  if (event.ctrlKey && event.code !== 'KeyR') return;
  if (!['Space', 'KeyS', 'KeyD', 'KeyA', 'KeyQ', 'KeyE', 'KeyC', 'KeyX', 'KeyZ', 'KeyM', 'KeyR'].includes(event.code)) return;
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
  // Key C to add 0.1 rate
  if (event.code === 'KeyC' && !event.target.closest('input, textarea')) {
    setPlaybackRate((parseFloat(currentPlaybackRate.value) + 0.1).toFixed(2));
  }
  // Key V to subtract 0.1 rate
  if (event.code === 'KeyX' && !event.target.closest('input, textarea')) {
    setPlaybackRate((parseFloat(currentPlaybackRate.value) - 0.1).toFixed(2));
  }
  // Key Z to reset playback rate to 1
  if (event.code === 'KeyZ' && !event.target.closest('input, textarea')) {
    setPlaybackRate(1);
  }
  // Key M to toggle mute
  if (event.code === 'KeyM' && !event.target.closest('input, textarea')) {
    muted.value = !muted.value;
    player.sound.value?.mute(muted.value);
  }
  // Control + KeyR to reload the page
  if (event.code === 'KeyR' && event.ctrlKey) {
    location.reload();
  }
}

onMounted(() => {
  loadLocalLessons();

  window.fileAPI.onFolderSelected((event, values) => {
    handleOpenFolderResult(values);
  });

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('pointerdown', handleScrollPointer);
});

onUnmounted(() => {
  clearTimeout(noSpeechNoticeTimer);
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('pointerdown', handleScrollPointer);
  player.releaseLesson();
  releaseRecordingResources();
});

class Player {
  constructor() {
    this.loadSessionId = 0;
    this.pendingSound = null;
    this.stepTimerId = null;
    this.sound = ref(null);
    this.currentLesson = null;
    this.currentSentence = ref(null);
    this.parsedSentences = ref([]);
    this.isScrolling = ref(false);
    this.currentPause = null;
    this.repeatOne = ref(settings.repeatOne);
    this.volume = volume;
    this.isShadowing = ref(false);
    this.playbackRate = currentPlaybackRate;
  }

  async playLesson(lesson) {
    this.releaseLesson();
    lessonLoading.value = true;
    followSentence.value = true;
    const sessionId = this.loadSessionId;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + "/" + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + "/" + lesson.audio.name;

    try {
      const lessonId = await window.fileAPI.recordingIdentity(JSON.parse(JSON.stringify(lesson)));
      if (sessionId !== this.loadSessionId) return;
      activeLessonId = lessonId;
      await refreshRecordings(lessonId, sessionId);
      if (sessionId !== this.loadSessionId) return;
      const content = await window.fileAPI.readTextFile(lyricsPath);
      if (sessionId !== this.loadSessionId) return;
      const sentences = lyricsPath.endsWith('.srt')
        ? parseSRT(content)
        : parseLRC(content);
      if (!sentences.length) throw new Error('字幕中没有可用的句子，请检查字幕文件。');
      this.initializeSound(audioFilePath, sentences, sessionId);
    } catch (error) {
      if (sessionId === this.loadSessionId) {
        lessonLoading.value = false;
        console.error('Error:', error);
        recordingError.value = error.message;
      }
    }
  }

  releaseLesson() {
    lessonLoading.value = false;
    this.loadSessionId++;
    this.stopCurrentPlayback();
    releaseRecordingResources();
    activeLessonId = null;
    recordings.value = {};
    clearTimeout(this.stepTimerId);
    this.stepTimerId = null;
    this.pendingSound?.unload();
    this.pendingSound = null;
    this.sound.value?.unload();
    this.sound.value = null;
    this.currentLesson = null;
    this.currentSentence.value = null;
    this.parsedSentences.value = [];
    this.isScrolling.value = false;
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
    }
  }

  initializeSound(audioFilePath, sentences, sessionId) {
      const sound = new Howl({
        preload: false,
        src: [audioFilePath],
        html5: true,
        format: ["mp3", "wav", "ogg", "aac", "flac", "m4a"],
        volume: this.volume.value / 100,
        mute: muted.value,
        rate: this.playbackRate.value,
        onload: () => {
          if (sessionId !== this.loadSessionId) return;
          lessonLoading.value = false;
          sentences[sentences.length - 1].end = sound.duration();
          this.pendingSound = null;
          this.sound.value = sound;
          this.parsedSentences.value = sentences;
          this.clickSentence(sentences[0]);
        },
        onloaderror: (id, error) => {
          if (sessionId !== this.loadSessionId) return;
          lessonLoading.value = false;
          recordingError.value = '课程音频无法打开，请检查文件是否存在且可以播放。';
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
          recordingError.value = '原声无法播放，请检查音频文件后重试。';
        },
        onend: () => {
          if (sessionId === this.loadSessionId) this.step(true);
        },
      });
      this.pendingSound = sound;
      sound.load();
  }

  scheduleStep() {
    clearTimeout(this.stepTimerId);
    const sessionId = this.loadSessionId;
    this.stepTimerId = setTimeout(() => {
      if (sessionId !== this.loadSessionId) return;
      this.stepTimerId = null;
      this.step();
    }, 20);
  }

  togglePlay() {
    if (zenMode.value) {
      if (zenPhase.value !== 'idle') this.stopCurrentPlayback();
      else startZenSentence();
      return;
    }
    stopPreview();
    if (this.sound.value.playing() || this.isShadowing.value) {
      const sentence = this.currentSentence.value;
      const wasShadowing = this.isShadowing.value;
      this.stopCurrentPlayback();
      if (wasShadowing) this.sound.value.seek(sentence.start);
    } else {
      this.sound.value.play();
    }
  }

  step(ended = false) {
    if (!this.sound.value || !this.currentSentence.value) return;
    if (this.isShadowing.value) return;
    if (!ended && !this.sound.value.playing()) return;

    const currentTime = ended ? this.sound.value.duration() : this.sound.value.seek() || 0;
    if (
      this.currentSentence.value &&
      currentTime >= this.currentSentence.value.end
    ) {
      if (zenMode.value && zenPhase.value === 'reference') {
        this.sound.value.pause();
        clearTimeout(this.stepTimerId);
        this.stepTimerId = null;
        zenPhase.value = 'second';
        this.isShadowing.value = true;
        startSentenceRecording(this.currentSentence.value);
        return;
      }
      if (shadowingMode.value && !zenMode.value) {
        if (!this.isShadowing.value) {
          this.sound.value.pause();
          clearTimeout(this.stepTimerId);
          this.stepTimerId = null;
          this.isShadowing.value = true;
          startSentenceRecording(this.currentSentence.value);
          return;
        }
      }

      this.advanceSentence();
      return;
    }
    let currentSentence = this.findCurrentSentence(currentTime);
    if (currentSentence !== this.currentSentence.value) {
      this.currentSentence.value = currentSentence;
      this.handleSentenceChange(currentSentence);
    }
    return this.scheduleStep();
  }

  advanceSentence() {
      if (this.repeatOne.value) {
        this.sound.value.seek(this.currentSentence.value.start);
        if (!this.sound.value.playing()) this.sound.value.play();
        this.scheduleStep();
        return;
      }
      const nextSentence = this.getNextSentence();
      if (!nextSentence) {
        this.sound.value.pause();
        clearTimeout(this.stepTimerId);
        this.stepTimerId = null;
        return;
      }
      this.currentSentence.value = nextSentence;
      this.sound.value.seek(nextSentence.start);
      if (!this.sound.value.playing()) this.sound.value.play();
      this.handleSentenceChange(nextSentence);
      this.scheduleStep();
      return;
  }

  findCurrentSentence(currentTime) {
    const sentences = this.parsedSentences.value;

    const currentSentence = sentences.find((sentence, index) => {
      const prevEnd = index > 0 ? sentences[index - 1].end : 0;
      return currentTime >= prevEnd && currentTime < sentence.end;
    });

    return currentSentence || sentences[0];
  }

  handleSentenceChange(sentence) {
    if (focusMode.value) return;
    if (!followSentence.value || !sentence) return;
    const element = document.getElementById(sentence.start.toString());
    element?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }

  getNextSentence() {
    let currentIndex = this.parsedSentences.value.indexOf(
      this.currentSentence.value
    );
    return this.parsedSentences.value[currentIndex + 1];
  }

  async clickSentence(sentence) {
    if (!this.sound.value || !sentence) return;
    this.stopCurrentPlayback();
    stopPreview();
    this.currentSentence.value = sentence;
    this.sound.value.volume(this.volume.value / 100);
    this.isShadowing.value = false;
    this.sound.value.seek(sentence.start);
    if (!zenMode.value) this.sound.value.play();
    this.handleSentenceChange(sentence);
  }

  stopCurrentPlayback() {
    zenSession++;
    zenPhase.value = 'idle';
    stopPreview();
    clearNoSpeechNotice();
    clearTimeout(this.stepTimerId);
    this.stepTimerId = null;
    if (this.sound.value?.playing()) {
      this.sound.value.pause();
    }
    if (this.currentPause) {
      clearTimeout(this.currentPause);
    }
    stopSentenceRecording(true);
    if (zenMode.value) releaseRecordingResources();
    this.isShadowing.value = false;
    if (this.sound.value) {
      this.sound.value.volume(this.volume.value / 100);
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  isElementInViewport(el) {
    var rect = el.getBoundingClientRect();
    var viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;

    var adjustedBottom = viewportHeight - 50;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= adjustedBottom &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Add this method to update playback rate
  setPlaybackRate(rate) {
    this.playbackRate.value = rate;
    if (this.sound.value) {
      this.sound.value.rate(rate);
    }
  }
}

const player = new Player();

watch([volume, muted, currentPlaybackRate, shadowingMode, player.repeatOne, rightDrawerOpen, zenFirstAttempt, practiceMethod],
  ([volume, muted, playbackRate, shadowing, repeatOne, drawerOpen, zenFirstAttempt, practiceMethod]) => {
    saveSettings({ volume, muted, playbackRate, shadowing, repeatOne, drawerOpen, zenFirstAttempt, practiceMethod });
  }, { flush: 'sync' });

function playLesson(index) {
  if (index >= 0 && index < lessons.value.length) {
    currentLessonIndex.value = index;
    player.playLesson(lessons.value[index]);
  }
}

function togglePlay() {
  if (player.sound.value) {
    player.togglePlay();
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
  if (
    player.parsedSentences.value[
    player.parsedSentences.value.indexOf(player.currentSentence.value) - 1
    ]
  ) {
    clearTimeout(player.currentPause);
    player.clickSentence(
      player.parsedSentences.value[
      player.parsedSentences.value.indexOf(player.currentSentence.value) - 1
      ]
    );
  }
}

function nextSentence() {
  if (
    player.parsedSentences.value[
    player.parsedSentences.value.indexOf(player.currentSentence.value) + 1
    ]
  ) {
    clearTimeout(player.currentPause);
    player.clickSentence(
      player.parsedSentences.value[
      player.parsedSentences.value.indexOf(player.currentSentence.value) + 1
      ]
    );
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
  window.fileAPI.openFolder();
}

function updateVolume(value) {
  player.volume.value = value;
  if (player.sound.value) {
    player.sound.value.volume(value / 100);
  }
}

function toggleShadowingMode() {
  if (!player.sound.value) return;
  player.stopCurrentPlayback();
  releaseRecordingResources();
  shadowingMode.value = !shadowingMode.value;
  zenMode.value = shadowingMode.value && practiceMethod.value !== 'listen';
  player.sound.value.seek(player.currentSentence.value.start);
}

function setPlaybackRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return;
  player.setPlaybackRate(Math.min(4, Math.max(0.1, value)));
}

async function ensureRecorderAccess() {
  if (typeof window === "undefined") {
    recordingError.value = "录音仅支持桌面应用。";
    return false;
  }

  if (recorderInitPromise) {
    return recorderInitPromise;
  }

  if (mediaRecorder) {
    return true;
  }

  const hasNavigator = typeof navigator !== "undefined";
  if (
    typeof window.MediaRecorder === "undefined" ||
    !hasNavigator ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    recordingError.value = "当前环境不支持录音，请使用桌面应用。";
    return false;
  }

  const accessSession = microphoneSession;
  recorderInitPromise = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then(async (stream) => {
      if (accessSession !== microphoneSession) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      mediaStream = stream;
      mediaRecorder = new MediaRecorder(stream);
      const monitor = createVoiceMonitor(stream);
      voiceMonitor = monitor;
      await monitor.ready();
      if (accessSession !== microphoneSession) return false;
      mediaRecorder.addEventListener("dataavailable", handleRecorderData);
      mediaRecorder.addEventListener("stop", handleRecorderStop);
      recordingError.value = "";
      return true;
    })
    .catch((error) => {
      if (accessSession !== microphoneSession) return false;
      if (player.isShadowing.value) {
        player.stopCurrentPlayback();
        player.sound.value?.seek(player.currentSentence.value.start);
      }
      releaseRecordingResources();
      recordingError.value =
        error?.name === 'NotAllowedError' ? '麦克风访问被拒绝，请在系统设置中允许使用麦克风后重试。' :
          error?.name === 'NotFoundError' ? '未检测到麦克风，请连接麦克风后重试。' :
            `无法访问麦克风：${error?.message || '请检查设备连接。'}`;
      return false;
    })
    .finally(() => {
      if (accessSession === microphoneSession) recorderInitPromise = null;
    });

  return recorderInitPromise;
}

function startSentenceRecording(sentence) {
  clearNoSpeechNotice();
  if (!sentence || (!shadowingMode.value && !zenMode.value)) {
    return;
  }

  const sessionId = player.loadSessionId;
  const maxMs = 10000;
  const attempt = ++recordingAttempt;
  recordingStatus.value = '正在准备麦克风…';
  ensureRecorderAccess().then(async (ready) => {
    if (attempt !== recordingAttempt) return;
    if (!ready) {
      player.stopCurrentPlayback();
      player.sound.value?.seek(sentence.start);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    if (
      attempt !== recordingAttempt ||
      !mediaRecorder ||
      (!shadowingMode.value && !zenMode.value) ||
      !player.isShadowing.value ||
      player.loadSessionId !== sessionId ||
      player.currentSentence.value !== sentence
    ) {
      return;
    }

    if (mediaRecorder.state === 'recording' || pendingRecordingSentence) {
      player.stopCurrentPlayback();
      player.sound.value?.seek(sentence.start);
      recordingError.value = '上一段录音正在结束，请按播放重试。';
      return;
    }
    stopPreview();

    const duration =
      Math.max((sentence.end ?? sentence.start) - sentence.start, 0) || 0;

    pendingRecordingSentence = {
      lessonId: activeLessonId,
      lessonName: player.currentLesson.name,
      start: sentence.start,
      end: sentence.end,
      text: sentence.text,
      duration,
    };

    isRecording.value = true;
    recordingChunks = [];
    mediaRecorder.start();
    recordingStartedAt = performance.now();
    recordingError.value = '';
    voiceMonitor.start(({ state, reason, voiceActive }) => {
      if (attempt !== recordingAttempt) return;
      recordingVoiceActive.value = Boolean(voiceActive);
      recordingStatus.value = { waiting: '请开始跟读…', speaking: '正在录音…', silence: '等待说完：静音 1.2 秒后结束' }[state];
      if (reason) finishShadowing(reason);
    }, { maxMs });
  }).catch((error) => {
    if (attempt !== recordingAttempt) return;
    player.stopCurrentPlayback();
    player.sound.value?.seek(sentence.start);
    releaseRecordingResources();
    recordingError.value = `录音启动失败：${error.message}`;
  });
}

function finishShadowing(reason = 'manual') {
  if (!isRecording.value || completedShadow) return;
  if (reason === 'no-speech') {
    player.stopCurrentPlayback();
    player.sound.value?.seek(player.currentSentence.value.start);
    noSpeechSentence.value = player.currentSentence.value.start;
    noSpeechNoticeTimer = setTimeout(() => {
      clearNoSpeechNotice();
    }, 1000);
    return;
  }
  completedShadow = { sessionId: player.loadSessionId, sentence: player.currentSentence.value,
    zenSession, zenPhase: zenMode.value ? zenPhase.value : null };
  recordingStatus.value = reason === 'limit' ? '已达到 10 秒录音上限，正在保存…' : '正在完成录音…';
  stopSentenceRecording();
}

function stopSentenceRecording(discard = false) {
  recordingVoiceActive.value = false;
  recordingAttempt++;
  voiceMonitor?.stop();

  if (discard) {
    completedShadow = null;
    recordingStatus.value = '';
    discardNextRecording = true;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }

  if (discard) {
    if (!pendingRecordingSentence) resetRecordingState();
  }
}

function handleRecorderData(event) {
  if (event.data && event.data.size > 0) {
    recordingChunks.push(event.data);
  }
}

function handleRecorderStop() {
  voiceMonitor?.stop();
  const completion = completedShadow;
  completedShadow = null;

  const shouldDiscard = discardNextRecording;
  discardNextRecording = false;

  if (
    shouldDiscard ||
    !pendingRecordingSentence ||
    recordingChunks.length === 0
  ) {
    resetRecordingState();
    if (!shouldDiscard && completion) player.stopCurrentPlayback();
    return;
  }

  const blob = new Blob(recordingChunks, {
    type: mediaRecorder?.mimeType || "audio/webm",
  });

  pendingRecordingSentence.duration = (performance.now() - recordingStartedAt) / 1000;
  if (completion?.zenPhase) {
    const meta = pendingRecordingSentence;
    resetRecordingState();
    completeZenRecording(completion, meta, blob);
    return;
  }
  saveRecording(pendingRecordingSentence, blob);
  resetRecordingState();
  if (completion && completion.sessionId === player.loadSessionId &&
      completion.sentence === player.currentSentence.value && player.isShadowing.value) {
    player.isShadowing.value = false;
    player.advanceSentence();
  }
}

function saveRecording(meta, blob) {
  const sessionId = player.loadSessionId;
  const task = (async () => {
    try {
      const clip = await window.fileAPI.saveRecording({
        lessonId: meta.lessonId, lessonName: meta.lessonName,
        start: meta.start, end: meta.end, text: meta.text, mime: blob.type,
      }, await blob.arrayBuffer());
      if (sessionId === player.loadSessionId && meta.lessonId === activeLessonId) {
        recordings.value = { ...recordings.value, [meta.start]: clip };
      }
      return clip;
    } catch (error) {
      recordingError.value = `录音保存失败：${error.message}`;
      throw error;
    }
  })();
  pendingSaves.add(task);
  task.finally(() => pendingSaves.delete(task)).catch(() => {});
  return task;
}

async function refreshRecordings(lessonId = activeLessonId, sessionId = player.loadSessionId) {
  if (!lessonId) return;
  const clips = await window.fileAPI.listRecordings(lessonId);
  if (sessionId !== player.loadSessionId || lessonId !== activeLessonId) return;
  const latest = {};
  for (const clip of clips) {
    if (!latest[clip.start]) latest[clip.start] = clip;
  }
  recordings.value = latest;
}

async function withStorageAction(action) {
  if (storageBusy.value) return;
  storageBusy.value = true;
  storageMessage.value = '';
  player.stopCurrentPlayback();
  stopPreview();
  try {
    await Promise.all([...pendingSaves]);
    await action();
  } catch (error) {
    recordingError.value = `录音操作失败：${error.message}`;
  } finally {
    storageBusy.value = false;
  }
}

function showRecordingHistory() {
  return withStorageAction(async () => {
    recordingHistory.value = await window.fileAPI.listRecordings();
    historyOpen.value = true;
  });
}

function exportRecordings() {
  return withStorageAction(async () => {
    const result = await window.fileAPI.exportRecordings();
    if (result) storageMessage.value = `已导出 ${result.count} 条录音：${result.path}`;
  });
}

function exportMergedRecording() {
  return withStorageAction(async () => {
    const clips = Object.values(recordings.value).sort((a, b) => a.start - b.start);
    if (!clips.length) return;
    storageMessage.value = '正在按句子顺序合并本课每句最新录音…';
    const bytes = await mergeRecordings(clips, (id) => window.fileAPI.readRecording(id));
    const destination = await window.fileAPI.exportMergedRecording(bytes);
    storageMessage.value = destination ? `已合并 ${clips.length} 句：${destination}。如需恢复记录，请使用“导出备份”。` : '';
  });
}

function restoreRecordings() {
  return withStorageAction(async () => {
    const result = await window.fileAPI.restoreRecordings();
    if (!result) return;
    await refreshRecordings();
    storageMessage.value = `恢复完成：新增 ${result.added} 条，已存在 ${result.skipped} 条。`;
  });
}

function resetRecordingState() {
  recordingVoiceActive.value = false;
  recordingStatus.value = '';
  isRecording.value = false;
  pendingRecordingSentence = null;
  recordingChunks = [];
  discardNextRecording = false;
}

function playUserRecording(sentenceStart) {
  const clip = recordings.value[sentenceStart];
  if (clip) previewRecording(clip);
}

function stopPreview() {
  previewSession++;
  previewClipId.value = null;
  if (previewAudio) {
    previewAudio.onended = null;
    previewAudio.onerror = null;
    previewAudio.pause();
    previewAudio.removeAttribute('src');
    previewAudio.load();
    previewAudio = null;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

async function previewRecording(clip, onComplete = null) {
  if (previewClipId.value === clip.id) {
    stopPreview();
    return;
  }
  if (!onComplete) player.stopCurrentPlayback();
  stopPreview();
  previewClipId.value = clip.id;
  const session = previewSession;
  try {
    const { bytes, mime } = await window.fileAPI.readRecording(clip.id);
    if (session !== previewSession) return;
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    previewAudio = new Audio(previewUrl);
    previewAudio.onended = () => {
      if (session === previewSession) {
        stopPreview();
        onComplete?.();
      }
    };
    previewAudio.onerror = () => {
      if (session !== previewSession) return;
      stopPreview();
      if (onComplete) player.stopCurrentPlayback();
      recordingError.value = '录音无法播放，请检查录音文件是否完整。';
    };
    await previewAudio.play();
  } catch (error) {
    if (session === previewSession) {
      stopPreview();
      if (onComplete) player.stopCurrentPlayback();
      recordingError.value = `录音播放失败：${error.message}`;
    }
  }
}

function releaseRecordingResources() {
  recordingAttempt++;
  completedShadow = null;
  voiceMonitor?.dispose();
  voiceMonitor = null;
  microphoneSession++;
  recorderInitPromise = null;
  stopPreview();
  if (mediaRecorder) {
    mediaRecorder.removeEventListener("dataavailable", handleRecorderData);
    mediaRecorder.removeEventListener("stop", handleRecorderStop);
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    mediaRecorder = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  resetRecordingState();
}
</script>
<style>
.zen-stage {
  min-height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 48px;
  max-width: 1100px;
  margin: auto;
  padding: 32px 24px 80px;
  text-align: center;
  overflow-wrap: anywhere;
}
.zen-current {
  font-size: clamp(24px, 4vw, 48px);
  line-height: 1.6;
  color: #20354b;
}
.zen-neighbor {
  min-height: 2em;
  max-height: 3em;
  overflow: hidden;
  font-size: clamp(16px, 2vw, 24px);
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
  min-height: 55vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  text-align: center;
}

.lesson-progress {
  position: sticky;
  top: 50px;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
}

.lesson-progress .ellipsis {
  flex: 1 1 180px;
  min-width: 0;
}

.sentence-item.sentence-preview,
.sentence-preview {
  background: #eaf2ff;
  box-shadow: inset -3px 0 #1976d2;
}

.sentence-item {
  min-height: 64px;
  color: #374151;
}

.sentence-item.sentence-item--active {
  background-color: #eaf2ff;
  color: #1e40af;
}

.playback-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.sentence-navigation {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.q-drawer {
  transition: box-shadow 0.2s;
}

.q-drawer--fixed {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
}

.lesson-item {
  transition: background-color 0.3s;
}

.lesson-item--active {
  background-color: #e0e0e0 !important;
  font-weight: bold;
}

.small-tooltip {
  font-size: 0.8em;
}

.volume-control-container {
  position: relative;
  display: inline-block;
}

.volume-slider-menu {
  border-radius: 4px;
  /* padding: 18px; */
  transition: opacity 0.3s;
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
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 4px 16px rgba(35, 49, 65, 0.10), 0 12px 32px rgba(35, 49, 65, 0.06);
  pointer-events: none;
  transform: translateX(-50%);
}

.practice-controls, .playback-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.practice-controls { grid-column: 1; grid-row: 1; }
.playback-options { grid-column: 3; grid-row: 1; justify-content: flex-end; }
.practice-menu { width: 360px; max-width: 90vw; }
.floating-phase {
  position: absolute;
  bottom: calc(100% + 28px);
  left: 50%;
  transform: translateX(-50%);
  color: #56728f;
  background: #edf3fa;
  border-radius: 50%;
  padding: 12px;
  pointer-events: none;
}
@media (max-width: 850px) {
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
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #d45360;
  background: #fff0f1;
  transition: color 240ms ease, background-color 240ms ease;
}

.recording-mic--floating {
  width: 46px;
  height: 46px;
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
  color: #229b72;
  background: #eaf8f1;
}

.recording-mic--active::before {
  animation: recording-ripple 1.8s ease-out infinite;
}

.recording-mic--first {
  color: #8053b5;
  background: #f4edfc;
}

.recording-mic--first::before {
  border: 2px dashed currentColor;
}

.recording-mic--first.recording-mic--active {
  color: #673ab7;
  background: #eadcfa;
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
  color: #b88429;
  background: #fff5e3;
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
  .recording-float-enter-active,
  .recording-float-leave-active {
    transition: none;
  }
}

</style>
