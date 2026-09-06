<template>
  <q-layout view="hHh lpR fFf" class="bg-grey-1">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title> Ecolingo </q-toolbar-title>
        <q-btn flat @click="openFolder" icon="folder_open">
          <q-tooltip class="small-tooltip">Open folder</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="rightDrawerOpen" show-if-above :breakpoint="500" side="right" bordered class="bg-white">
      <q-scroll-area class="fit">
        <q-list>
          <q-item-label header>Lesson List</q-item-label>
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
        <q-banner v-if="recordingError" class="bg-red-1 text-negative q-mb-md">
          <template #avatar>
            <q-icon name="warning" color="negative" />
          </template>
          {{ recordingError }}
        </q-banner>
        <div id="sentences" class="q-pa-md">
          <q-list separator>
            <q-item v-for="s in player.parsedSentences.value" :key="s.start" clickable v-ripple
              @click="player.clickSentence(s)" :active="player.currentSentence.value === s" :class="{
                'shadowing-sentence':
                  player.isShadowing.value &&
                  player.currentSentence.value === s,
                'sentence-being-recorded': currentRecordingSentence === s.start,
                'sentence-has-recording': Boolean(recordings[s.start]),
              }">
              <q-item-section avatar v-if="
                player.isShadowing.value && player.currentSentence.value === s
              ">
                <q-icon name="record_voice_over" color="blue" />
              </q-item-section>
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
              </q-item-section>
              <q-item-section side class="sentence-actions">
                <q-badge v-if="currentRecordingSentence === s.start" color="red-5" text-color="white"
                  class="recording-badge">
                  REC
                </q-badge>
                <q-btn v-if="recordings[s.start]" round dense flat icon="play_circle"
                  @click.stop="playUserRecording(s.start)"
                  :disable="isRecording && currentRecordingSentence === s.start">
                  <q-tooltip class="small-tooltip">Play your recording</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>
      </q-page>
    </q-page-container>

    <q-footer elevated class="bg-grey-8 text-white">
      <q-toolbar>
        <q-btn flat dense icon="skip_previous" @click="prev">
          <q-tooltip class="small-tooltip">Previous lesson</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="fast_rewind" @click="beforeSentence">
          <q-tooltip class="small-tooltip">Previous sentence</q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="player.sound.value && player.sound.value.playing()
          ? 'pause'
          : 'play_arrow'
          " @click="togglePlay">
          <q-tooltip class="small-tooltip">{{
            player.sound.value && player.sound.value.playing()
              ? "Pause"
              : "Play"
          }}</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="fast_forward" @click="nextSentence">
          <q-tooltip class="small-tooltip">Next sentence</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="skip_next" @click="next">
          <q-tooltip class="small-tooltip">Next lesson</q-tooltip>
        </q-btn>

        <q-space />

        <template v-if="!shadowingMode">
          <div class="volume-control-container" @mouseenter="showVolumeSlider" @mouseleave="startHideTimer">
            <q-btn flat dense icon="volume_up" class="volume-control" />
            <q-menu v-model="volumeSliderVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
              class="q-pa-md no-shadow transparent" @mouseenter="cancelHideTimer" @mouseleave="startHideTimer">
              <q-slider v-model="volume" :min="0" :max="100" vertical reverse @change="updateVolume" class="no-border"
                style="height: 80px" />
            </q-menu>
          </div>
        </template>
        <q-btn flat dense :icon="shadowingMode ? 'record_voice_over' : 'voice_over_off'" @click="toggleShadowingMode">
          <q-tooltip class="small-tooltip">
            {{ shadowingMode ? "Shadowing off" : "Shadowing on" }}
          </q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="player.repeatOne.value ? 'repeat_one' : 'repeat'"
          @click="player.repeatOne.value = !player.repeatOne.value">
          <q-tooltip class="small-tooltip">{{
            player.repeatOne.value ? "Repeat one off" : "Repeat one on"
            }}</q-tooltip>
        </q-btn>

        <!-- Add this new button for playback rate control -->
        <div @mouseenter="showPlaybackRateMenu" @mouseleave="startHidePlaybackRateTimer">
          <q-btn flat dense :label="currentPlaybackRate + 'x'" class="playback-rate-control" />
          <q-menu v-model="playbackRateMenuVisible" anchor="top right" self="bottom right" :offset="[10, 0]"
            class="q-pa-sm" @mouseenter="cancelHidePlaybackRateTimer" @mouseleave="startHidePlaybackRateTimer">
            <q-list dense>
              <q-item v-for="rate in playbackRates" :key="rate" clickable v-close-popup @click="setPlaybackRate(rate)">
                <q-item-section>{{ rate }}x</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </div>
        <q-btn flat dense icon="menu" @click="rightDrawerOpen = !rightDrawerOpen">
          <q-tooltip class="small-tooltip">Toggle lesson list</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, ref, onUnmounted } from "vue";
import { parseLRC } from "../utils/lyrics-util";
import { Howl } from "howler";

const rightDrawerOpen = ref(true);
const lessons = ref([]);
const currentLessonIndex = ref(-1);
const volume = ref(100);
const volumeSliderVisible = ref(false);
let hideTimerId = null;

const shadowingMode = ref(false);
const recordings = ref({});
const isRecording = ref(false);
const currentRecordingSentence = ref(null);
const recordingError = ref("");
let mediaRecorder = null;
let mediaStream = null;
let recordingChunks = [];
let recordingTimeoutId = null;
let pendingRecordingSentence = null;
let recorderInitPromise = null;
let discardNextRecording = false;
let previewAudio = null;

// Add these new refs and constants
const playbackRateMenuVisible = ref(false);
const currentPlaybackRate = ref(1);
const playbackRates = [0.5, 0.75, 1, 1.25, 1.5];
let hidePlaybackRateTimerId = null;

function handleKeyDown(event) {
  console.log(event.code);
  event.preventDefault();
  event.target.blur();
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
    player.sound.value?.mute(!player.sound.value.mute());
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
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
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
    this.repeatOne = ref(false);
    this.volume = ref(100);
    this.isShadowing = ref(false);
    this.playbackRate = ref(1);
  }

  async playLesson(lesson) {
    this.releaseLesson();
    const sessionId = this.loadSessionId;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + "/" + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + "/" + lesson.audio.name;

    try {
      const content = await window.fileAPI.readTextFile(lyricsPath);
      if (sessionId !== this.loadSessionId) return;
      const sentences = lyricsPath.endsWith('.srt')
        ? parseSRT(content)
        : parseLRC(content);
      if (!sentences.length) throw new Error('No sentences found in transcript.');
      this.initializeSound(audioFilePath, sentences, sessionId);
    } catch (error) {
      if (sessionId === this.loadSessionId) {
        console.error('Error:', error);
      }
    }
  }

  releaseLesson() {
    this.loadSessionId++;
    this.stopCurrentPlayback();
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
        rate: this.playbackRate.value,
        onload: () => {
          if (sessionId !== this.loadSessionId) return;
          sentences[sentences.length - 1].end = sound.duration();
          this.pendingSound = null;
          this.sound.value = sound;
          this.parsedSentences.value = sentences;
          this.clickSentence(sentences[0]);
        },
        onloaderror: (id, error) => {
          if (sessionId !== this.loadSessionId) return;
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
    if (this.sound.value.playing()) {
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
    if (!ended && !this.sound.value.playing()) return;

    const currentTime = ended ? this.sound.value.duration() : this.sound.value.seek() || 0;
    if (
      this.currentSentence.value &&
      currentTime >= this.currentSentence.value.end
    ) {
      if (shadowingMode.value) {
        if (!this.isShadowing.value) {
          this.sound.value.volume(0);
          this.isShadowing.value = true;
          startSentenceRecording(this.currentSentence.value);
          this.sound.value.seek(this.currentSentence.value.start);
          if (!this.sound.value.playing()) this.sound.value.play();
          this.scheduleStep();
          return;
        } else {
          stopSentenceRecording();
          this.sound.value.volume(this.volume.value / 100);
          this.isShadowing.value = false;
        }
      }

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
    let currentSentence = this.findCurrentSentence(currentTime);
    if (currentSentence !== this.currentSentence.value) {
      this.currentSentence.value = currentSentence;
      this.handleSentenceChange(currentSentence);
    }
    return this.scheduleStep();
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
    var element = document.getElementById(sentence.start.toString());
    if (element && !this.isElementInViewport(element)) {
      this.isScrolling.value = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      const sessionId = this.loadSessionId;
      setTimeout(() => {
        if (sessionId !== this.loadSessionId) return;
        this.isScrolling.value = false;
      }, 300);
    }
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
    this.currentSentence.value = sentence;
    this.sound.value.volume(this.volume.value / 100);
    this.isShadowing.value = false;
    this.sound.value.seek(sentence.start);
    this.sound.value.play();
  }

  stopCurrentPlayback() {
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
  if (player.sound.value) {
    player.sound.value.volume(value / 100);
  }
}

function showVolumeSlider() {
  volumeSliderVisible.value = true;
  cancelHideTimer();
}

function startHideTimer() {
  cancelHideTimer();
  hideTimerId = setTimeout(() => {
    volumeSliderVisible.value = false;
  }, 800);
}

function cancelHideTimer() {
  if (hideTimerId !== null) {
    clearTimeout(hideTimerId);
    hideTimerId = null;
  }
}

async function toggleShadowingMode() {
  if (shadowingMode.value) {
    shadowingMode.value = false;
    stopSentenceRecording(true);
    player.isShadowing.value = false;
    if (player.sound.value) {
      player.sound.value.volume(volume.value / 100);
    }
    return;
  }

  const ready = await ensureRecorderAccess();
  if (ready) {
    shadowingMode.value = true;
  }
}

// Add these new functions
function showPlaybackRateMenu() {
  playbackRateMenuVisible.value = true;
  cancelHidePlaybackRateTimer();
}

function startHidePlaybackRateTimer() {
  cancelHidePlaybackRateTimer();
  hidePlaybackRateTimerId = setTimeout(() => {
    playbackRateMenuVisible.value = false;
  }, 800);
}

function cancelHidePlaybackRateTimer() {
  if (hidePlaybackRateTimerId !== null) {
    clearTimeout(hidePlaybackRateTimerId);
    hidePlaybackRateTimerId = null;
  }
}

function setPlaybackRate(rate) {
  currentPlaybackRate.value = rate;
  if (player.sound.value) {
    player.sound.value.rate(rate);
  }
}

async function ensureRecorderAccess() {
  if (typeof window === "undefined") {
    recordingError.value = "Recording is only available in the desktop app.";
    return false;
  }

  if (mediaRecorder) {
    return true;
  }

  if (recorderInitPromise) {
    return recorderInitPromise;
  }

  const hasNavigator = typeof navigator !== "undefined";
  if (
    typeof window.MediaRecorder === "undefined" ||
    !hasNavigator ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    recordingError.value = "Recording is not supported in this environment.";
    return false;
  }

  recorderInitPromise = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      mediaStream = stream;
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.addEventListener("dataavailable", handleRecorderData);
      mediaRecorder.addEventListener("stop", handleRecorderStop);
      recordingError.value = "";
      return true;
    })
    .catch((error) => {
      recordingError.value =
        error?.message || "Unable to access the microphone.";
      return false;
    })
    .finally(() => {
      recorderInitPromise = null;
    });

  return recorderInitPromise;
}

function startSentenceRecording(sentence) {
  if (!sentence || !shadowingMode.value) {
    return;
  }

  const sessionId = player.loadSessionId;
  ensureRecorderAccess().then((ready) => {
    if (
      !ready ||
      !mediaRecorder ||
      shadowingMode.value === false ||
      !player.isShadowing.value ||
      player.loadSessionId !== sessionId ||
      player.currentSentence.value !== sentence
    ) {
      return;
    }

    if (mediaRecorder.state === "recording") {
      discardNextRecording = true;
      mediaRecorder.stop();
    }

    const duration =
      Math.max((sentence.end ?? sentence.start) - sentence.start, 0) || 0;

    pendingRecordingSentence = {
      start: sentence.start,
      text: sentence.text,
      duration,
    };

    isRecording.value = true;
    recordingChunks = [];
    currentRecordingSentence.value = sentence.start;
    mediaRecorder.start();

    if (recordingTimeoutId) {
      clearTimeout(recordingTimeoutId);
    }

    // The playback clock ends recording, including when playback speed changes.
  });
}

function stopSentenceRecording(discard = false) {
  if (recordingTimeoutId) {
    clearTimeout(recordingTimeoutId);
    recordingTimeoutId = null;
  }

  if (discard) {
    discardNextRecording = true;
  }

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    return;
  }

  if (discard) {
    resetRecordingState();
    discardNextRecording = false;
  }
}

function handleRecorderData(event) {
  if (event.data && event.data.size > 0) {
    recordingChunks.push(event.data);
  }
}

function handleRecorderStop() {
  if (recordingTimeoutId) {
    clearTimeout(recordingTimeoutId);
    recordingTimeoutId = null;
  }

  const shouldDiscard = discardNextRecording;
  discardNextRecording = false;

  if (
    shouldDiscard ||
    !pendingRecordingSentence ||
    recordingChunks.length === 0
  ) {
    resetRecordingState();
    return;
  }

  const blob = new Blob(recordingChunks, {
    type: mediaRecorder?.mimeType || "audio/webm",
  });

  saveRecording(pendingRecordingSentence, blob);
  resetRecordingState();
}

function saveRecording(meta, blob) {
  const url = URL.createObjectURL(blob);
  const existing = recordings.value[meta.start];
  if (existing?.url) {
    URL.revokeObjectURL(existing.url);
  }

  recordings.value = {
    ...recordings.value,
    [meta.start]: {
      url,
      text: meta.text,
      duration: meta.duration,
      updatedAt: Date.now(),
    },
  };
}

function resetRecordingState() {
  isRecording.value = false;
  currentRecordingSentence.value = null;
  pendingRecordingSentence = null;
  recordingChunks = [];
  discardNextRecording = false;
}

function playUserRecording(sentenceStart) {
  const recording = recordings.value[sentenceStart];
  if (!recording) {
    return;
  }

  if (previewAudio) {
    previewAudio.pause();
  }

  previewAudio = new Audio(recording.url);
  previewAudio.play();
}

function releaseRecordingResources() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio = null;
  }

  Object.values(recordings.value).forEach((clip) => {
    if (clip?.url) {
      URL.revokeObjectURL(clip.url);
    }
  });

  if (mediaRecorder) {
    mediaRecorder.removeEventListener("dataavailable", handleRecorderData);
    mediaRecorder.removeEventListener("stop", handleRecorderStop);
    mediaRecorder = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
}
</script>
<style>
.q-item.q-item--active {
  background-color: #e0e0e0;
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

.shadowing-sentence {
  background-color: rgba(0, 128, 255, 0.1);
  border-left: 4px solid #0080ff;
  font-weight: bold;
  transition: all 0.3s ease;
}

.shadowing-sentence .q-item__label {
  color: #0080ff;
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
  gap: 6px;
}

.recording-badge {
  font-weight: 600;
  letter-spacing: 0.5px;
}

.sentence-being-recorded {
  border-left: 4px solid #f44336;
  background-color: rgba(244, 67, 54, 0.08);
}

.sentence-has-recording:not(.sentence-being-recorded) {
  border-left: 4px solid #2e7d32;
  background-color: rgba(76, 175, 80, 0.08);
}
</style>
