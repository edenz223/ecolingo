<template>
  <q-layout view="hHh lpR fFf" class="bg-grey-1">
    <q-header elevated class="bg-primary text-white">
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

    <q-drawer v-model="rightDrawerOpen" show-if-above :breakpoint="500" side="right" bordered class="bg-white">
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
        <div v-else class="lesson-progress">
          <div class="ellipsis">{{ lessons[currentLessonIndex]?.name || player.currentLesson?.name }}</div>
          <span class="text-grey-7">第 {{ Math.max(1, player.parsedSentences.value.indexOf(player.currentSentence.value) + 1) }} / {{ player.parsedSentences.value.length }} 句</span>
          <q-btn v-if="!followSentence" flat dense color="primary" icon="my_location" label="回到当前句" @click="resumeFollowing" />
        </div>
        <div id="sentences" class="q-pa-md" @wheel.passive="pauseFollowing" @touchmove.passive="pauseFollowing">
          <q-list separator>
            <q-item v-for="s in player.parsedSentences.value" :key="s.start" clickable v-ripple
              class="sentence-item" active-class="sentence-item--active"
              :class="{ 'sentence-preview': previewClipId && recordings[s.start]?.id === previewClipId }"
              @click="player.clickSentence(s)" :active="!previewClipId && player.currentSentence.value === s">
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
              </q-item-section>
              <q-item-section side class="sentence-actions">
                <div v-if="currentRecordingSentence === s.start || noSpeechSentence === s.start" class="sentence-recording">
                  <div class="recording-indicator" role="img" :aria-label="noSpeechSentence === s.start ? '未检测到声音，已暂停' : '正在录音'">
                    <span class="recording-mic" :class="{ 'recording-mic--active': recordingVoiceActive && noSpeechSentence !== s.start, 'recording-mic--silent': noSpeechSentence === s.start }" aria-hidden="true">
                      <q-icon :name="noSpeechSentence === s.start ? 'mic_off' : 'mic'" size="18px" />
                    </span>
                  </div>
                </div>
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

        <q-space />

        <template v-if="!shadowingMode">
          <q-btn flat dense icon="volume_up" class="volume-control" aria-label="音量" :disable="!player.sound.value">
            <q-tooltip>音量 · M 静音</q-tooltip>
            <q-menu v-model="volumeSliderVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
              class="q-pa-md">
              <q-slider v-model="volume" aria-label="音量" :min="0" :max="100" vertical reverse @change="updateVolume" class="no-border"
                style="height: 80px" />
            </q-menu>
          </q-btn>
        </template>
          <q-toggle :model-value="shadowingMode" label="跟读" color="light-blue-4"
            :disable="!player.sound.value" @update:model-value="toggleShadowingMode">
            <q-tooltip class="small-tooltip">
              {{ shadowingMode ? '关闭跟读' : '开启跟读' }} · S
            </q-tooltip>
          </q-toggle>
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
        <q-btn flat dense icon="queue_music" label="课程" aria-label="显示或隐藏课程列表"
          :aria-expanded="rightDrawerOpen" @click="rightDrawerOpen = !rightDrawerOpen">
          <q-tooltip class="small-tooltip">课程列表 · Q / E 切换课程</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, ref, onUnmounted, watch } from "vue";
import { parseLRC } from "../utils/lyrics-util";
import { Howl } from "howler";
import { mergeRecordings } from '../utils/recording-export';
import { createVoiceMonitor } from '../utils/voice-activity';
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
const recordings = ref({});
const isRecording = ref(false);
const currentRecordingSentence = ref(null);
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
      if (shadowingMode.value) {
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
    this.sound.value.play();
    this.handleSentenceChange(sentence);
  }

  stopCurrentPlayback() {
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

watch([volume, muted, currentPlaybackRate, shadowingMode, player.repeatOne, rightDrawerOpen],
  ([volume, muted, playbackRate, shadowing, repeatOne, drawerOpen]) => {
    saveSettings({ volume, muted, playbackRate, shadowing, repeatOne, drawerOpen });
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

function parseSRT(content) {
  const lines = content.trim().split(/\r?\n\r?\n/);
  return lines.map((block) => {
    const [id, time, ...textLines] = block.split(/\r?\n/);
    const [startTime, endTime] = time.split(" --> ").map(timeToSeconds);
    return {
      start: startTime,
      end: endTime,
      text: textLines.join(" "),
    };
  });
}

function timeToSeconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(":");
  return (
    parseFloat(hours) * 3600 +
    parseFloat(minutes) * 60 +
    parseFloat(seconds.replace(",", "."))
  );
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

async function toggleShadowingMode() {
  if (!player.sound.value) return;
  if (shadowingMode.value) {
    const wasShadowing = player.isShadowing.value;
    if (wasShadowing) player.stopCurrentPlayback();
    shadowingMode.value = false;
    stopSentenceRecording(true);
    releaseRecordingResources();
    player.isShadowing.value = false;
    if (player.sound.value) {
      player.sound.value.volume(volume.value / 100);
      if (wasShadowing) player.sound.value.seek(player.currentSentence.value.start);
    }
    return;
  }

  const sessionId = player.loadSessionId;
  const ready = await ensureRecorderAccess();
  if (ready && sessionId === player.loadSessionId) {
    shadowingMode.value = true;
  }
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
  if (!sentence || !shadowingMode.value) {
    return;
  }

  const sessionId = player.loadSessionId;
  const maxMs = ((sentence.end - sentence.start) / Number(currentPlaybackRate.value)) * 2000;
  if (!Number.isFinite(maxMs) || maxMs <= 0) {
    player.stopCurrentPlayback();
    recordingError.value = '当前句子的时长无效，无法开始录音。请检查字幕时间。';
    return;
  }
  const attempt = ++recordingAttempt;
  recordingStatus.value = '正在准备麦克风…';
  ensureRecorderAccess().then((ready) => {
    if (attempt !== recordingAttempt) return;
    if (!ready) {
      player.stopCurrentPlayback();
      player.sound.value?.seek(sentence.start);
      return;
    }
    if (
      !mediaRecorder ||
      shadowingMode.value === false ||
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
    currentRecordingSentence.value = sentence.start;
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
  completedShadow = { sessionId: player.loadSessionId, sentence: player.currentSentence.value };
  recordingStatus.value = reason === 'limit' ? '已达到本句播放时长的两倍，正在保存…' : '正在完成录音…';
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
    } catch (error) {
      recordingError.value = `录音保存失败：${error.message}`;
      throw error;
    }
  })();
  pendingSaves.add(task);
  task.finally(() => pendingSaves.delete(task)).catch(() => {});
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
  currentRecordingSentence.value = null;
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

async function previewRecording(clip) {
  if (previewClipId.value === clip.id) {
    stopPreview();
    return;
  }
  player.stopCurrentPlayback();
  stopPreview();
  previewClipId.value = clip.id;
  const session = previewSession;
  try {
    const { bytes, mime } = await window.fileAPI.readRecording(clip.id);
    if (session !== previewSession) return;
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    previewAudio = new Audio(previewUrl);
    previewAudio.onended = () => {
      if (session === previewSession) stopPreview();
    };
    previewAudio.onerror = () => {
      if (session !== previewSession) return;
      stopPreview();
      recordingError.value = '录音无法播放，请检查录音文件是否完整。';
    };
    await previewAudio.play();
  } catch (error) {
    if (session === previewSession) {
      stopPreview();
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
  gap: 8px;
  padding-top: 8px;
  padding-bottom: 8px;
}

.sentence-navigation {
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

.recording-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sentence-recording {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  padding: 4px;
  white-space: normal;
}

.recording-mic {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #d32f2f;
  background: #ffebee;
}

.recording-mic--active {
  color: #2e7d32;
  background: #e8f5e9;
}

.recording-mic--active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid #43a047;
  border-radius: 50%;
  animation: recording-pulse 900ms ease-out infinite;
}

@keyframes recording-pulse {
  from { transform: scale(1); opacity: 0.9; }
  to { transform: scale(1.45); opacity: 0; }
}

.recording-mic--silent {
  color: #9a6700;
  background: #fff3cd;
}

.recording-mic--silent::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid #d49b00;
  border-radius: 50%;
  animation: recording-pulse 500ms ease-out 2;
}

@media (prefers-reduced-motion: reduce) {
  .recording-mic--active::after,
  .recording-mic--silent::after {
    animation: none;
  }
}

</style>
