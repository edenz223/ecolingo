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
        <div id="sentences" class="q-pa-md">
          <q-list separator>
            <q-item v-for="s in player.parsedSentences.value" :key="s.start" clickable v-ripple
              @click="player.clickSentence(s)" :active="player.currentSentence.value === s" :class="{
                'shadowing-sentence':
                  player.isShadowing.value &&
                  player.currentSentence.value === s,
              }">
              <q-item-section avatar v-if="
                player.isShadowing.value && player.currentSentence.value === s
              ">
                <q-icon name="record_voice_over" color="blue" />
              </q-item-section>
              <q-item-section>
                <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
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
    player.sound.value.mute(!player.sound.value.mute());
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
});

class Player {
  constructor() {
    this.prevSound = null;
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

  playLesson(lesson) {
    this.prevSound = this.sound.value;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + "/" + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + "/" + lesson.audio.name;

    window.fileAPI
      .readTextFile(lyricsPath)
      .then((content) => {
        if (lyricsPath.endsWith(".srt")) {
          this.parsedSentences.value = parseSRT(content);
        } else {
          this.parsedSentences.value = parseLRC(content);
        }
        return this.initializeSound(audioFilePath);
      })
      .then(() => {
        if (this.prevSound) {
          this.prevSound.pause();
        }
        this.clickSentence(this.parsedSentences.value[0]);
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  initializeSound(audioFilePath) {
    return new Promise((resolve, reject) => {
      this.sound.value = new Howl({
        src: [audioFilePath],
        html5: true,
        format: ["mp3", "wav", "ogg", "aac", "flac", "m4a"],
        volume: this.volume.value / 100,
        rate: this.playbackRate.value,
        onload: () => {
          this.parsedSentences.value[
            this.parsedSentences.value.length - 1
          ].end = this.sound.value.duration();
          resolve();
        },
        onloaderror: (id, error) => {
          reject(error);
        },
        onplay: () => {
          requestAnimationFrame(this.step.bind(this));
        },
      });
    });
  }

  togglePlay() {
    if (this.sound.value.playing()) {
      this.sound.value.pause();
    } else {
      this.sound.value.play();
    }
  }

  step() {
    if (
      !this.sound.value.playing() &&
      this.currentSentence.value.start !== this.sound.value.seek()
    ) {
      return;
    }

    if (this.isScrolling.value) {
      requestAnimationFrame(this.step.bind(this));
      return;
    }

    var currentTime = this.sound.value.seek() || 0;
    if (
      this.currentSentence.value &&
      currentTime >= this.currentSentence.value.end
    ) {
      if (shadowingMode.value) {
        if (!this.isShadowing.value) {
          this.sound.value.volume(0);
          this.isShadowing.value = true;
          this.sound.value.seek(this.currentSentence.value.start);
          requestAnimationFrame(this.step.bind(this));
          return;
        } else {
          this.sound.value.volume(this.volume.value / 100);
          this.isShadowing.value = false;
        }
      }

      if (this.repeatOne.value) {
        this.sound.value.seek(this.currentSentence.value.start);
        requestAnimationFrame(this.step.bind(this));
        return;
      }
    }
    let currentSentence = this.findCurrentSentence(currentTime);
    if (currentSentence !== this.currentSentence.value) {
      this.currentSentence.value = currentSentence;
      this.handleSentenceChange(currentSentence);
    }
    return requestAnimationFrame(this.step.bind(this));
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
      setTimeout(() => {
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
    if (!this.sound.value) return;
    this.stopCurrentPlayback();
    this.currentSentence.value = sentence;
    this.sound.value.volume(this.volume.value / 100);
    this.isShadowing.value = false;
    this.sound.value.seek(sentence.start);
    this.sound.value.play();
  }

  stopCurrentPlayback() {
    if (this.sound.value.playing()) {
      this.sound.value.pause();
    }
    if (this.currentPause) {
      clearTimeout(this.currentPause);
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

function toggleShadowingMode() {
  shadowingMode.value = !shadowingMode.value;
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
</style>
