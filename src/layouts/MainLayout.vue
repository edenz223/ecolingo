<template>
  <q-layout view="hHh lpR fFf" class="bg-grey-1">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-toolbar-title>
          Ecolingo
        </q-toolbar-title>
        <q-btn flat @click="openFolder" icon="folder_open">
          <q-tooltip>Open Folder</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="rightDrawerOpen" show-if-above :breakpoint="500" side="right" bordered class="bg-white">
      <q-scroll-area class="fit">
        <q-list>
          <q-item-label header>Lessons</q-item-label>
          <q-item v-for="(lesson, index) in lessons" :key="lesson.name" clickable v-ripple @click="playLesson(index)"
            :class="{ 'lesson-item': true, 'lesson-item--active': currentLessonIndex === index }">
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
              @click="player.clickSentence(s)" :active="player.currentSentence.value === s">
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
          <q-tooltip>Previous lesson</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="fast_rewind" @click="beforeSentence">
          <q-tooltip>Previous sentence</q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="player.sound.value && player.sound.value.playing() ? 'pause' : 'play_arrow'"
          @click="togglePlay">
          <q-tooltip>{{ player.sound.value && player.sound.value.playing() ? 'Pause' : 'Play' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="fast_forward" @click="nextSentence">
          <q-tooltip>Next sentence</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="skip_next" @click="next">
          <q-tooltip>Next lesson</q-tooltip>
        </q-btn>

        <q-space />

        <q-btn flat dense :icon="player.repeatOne.value ? 'repeat_one' : 'repeat'"
          @click="player.repeatOne.value = !player.repeatOne.value">
          <q-tooltip>{{ player.repeatOne.value ? 'Repeat one off' : 'Repeat one on' }}</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="menu" @click="rightDrawerOpen = !rightDrawerOpen">
          <q-tooltip>Toggle lesson list</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, ref } from "vue";
import { parseLRC } from "../utils/lyrics-util";
import { Howl } from "howler";
import { useQuasar } from 'quasar'

const $q = useQuasar()

const rightDrawerOpen = ref(true); // 将初始值设置为 true，使侧栏默认打开
const lessons = ref([]);
const currentLessonIndex = ref(-1); // Add this line to track the current lesson index

onMounted(() => {
  loadLocalLessons();

  window.fileAPI.onFolderSelected((event, values) => {
    handleOpenFolderResult(values);
  });
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
  }

  playLesson(lesson) {
    this.prevSound = this.sound.value;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + "/" + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + "/" + lesson.audio.name;

    window.fileAPI
      .readTextFile(lyricsPath)
      .then((content) => {
        if (lyricsPath.endsWith('.srt')) {
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
        format: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
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
    if (!this.sound.value.playing()) {
      return;
    }

    if (this.isScrolling.value) {
      requestAnimationFrame(this.step.bind(this));
      return;
    }

    var currentTime = this.sound.value.seek() || 0;

    if (
      this.currentSentence.value &&
      currentTime >= this.currentSentence.value.end &&
      this.repeatOne.value
    ) {
      this.sound.value.seek(this.currentSentence.value.start);
      requestAnimationFrame(this.step.bind(this));
      return;
    }
    let currentSentence = this.findCurrentSentence(currentTime);
    if (currentSentence !== this.currentSentence.value) {
      this.currentSentence.value = currentSentence;
      this.handleSentenceChange(currentSentence);
    }
    requestAnimationFrame(this.step.bind(this));
  }

  findCurrentSentence(currentTime) {
    return this.parsedSentences.value.find(
      (sentence) => currentTime >= sentence.start && currentTime < sentence.end
    );
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

    // Adjust the bottom threshold by the height of the footer
    var adjustedBottom = viewportHeight - 50;

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= adjustedBottom && // Use the adjusted bottom threshold
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
}

// 创建 Player 实例
const player = new Player();

// 将原来的方法替换为 player 的方法
function playLesson(index) {
  if (index >= 0 && index < lessons.value.length) {
    currentLessonIndex.value = index;
    player.playLesson(lessons.value[index]);
  }
}

function togglePlay() {
  player.togglePlay();
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
  // currentSentence.value = parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) - 1];
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
  // currentSentence.value = parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) + 1];
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
  if (player.sound.value.playing()) {
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
  if (player.sound.value.playing()) {
    player.sound.value.pause();
  }

  if (currentLessonIndex.value < lessons.value.length - 1) {
    currentLessonIndex.value++;
  } else {
    currentLessonIndex.value = 0;
  }
  playLesson(currentLessonIndex.value);
}

// 在 import 语句下面添加这个新函数
function parseSRT(content) {
  const lines = content.trim().split(/\r?\n\r?\n/);
  return lines.map(block => {
    const [id, time, ...textLines] = block.split(/\r?\n/);
    const [startTime, endTime] = time.split(' --> ').map(timeToSeconds);
    return {
      start: startTime,
      end: endTime,
      text: textLines.join(' ')
    };
  });
}

function timeToSeconds(timeString) {
  const [hours, minutes, seconds] = timeString.split(':');
  return parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds.replace(',', '.'));
}

function openFolder() {
  window.fileAPI.openFolder();
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
</style>
