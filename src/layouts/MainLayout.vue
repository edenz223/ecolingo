<template>
  <q-layout view="hHh lpR fFr" class="electron">
    <q-page-container>
      <audio id="player">Player</audio>
      <div id="sentences">
        <q-list class="sentence" v-for="s in player.parsedSentences.value" :key="s" @click="player.clickSentence(s)">
          <q-item clickable v-ripple>
            <q-item-section :id="s.start.toString()" v-if="player.currentSentence.value === s" class="text-primary">
              {{ s.text }}
            </q-item-section>
            <q-item-section :id="s.start.toString()" v-else>
              {{ s.text }}
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-page-container>
    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" behavior="desktop" bordered>
      <q-list dense bordered>
        <q-item clickable v-ripple v-for="lesson in lessons" :key="lesson.name" @click="playLesson(lesson)">
          <q-item-section>
            <q-item-label>{{ lesson.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
    <q-footer class="bg-grey-8 text-white">
      <div class="row">
        <q-btn flat class="col-2" @click="player.repeatOne.value = !player.repeatOne.value" dense :icon="player.repeatOne.value === true ? 'repeat_one_on' : 'repeat_one'
          " />

        <q-toolbar class="col-8">
          <div class="fit row wrap justify-center ">
            <q-btn flat icon="skip_previous" @click="prev">
              <q-tooltip>Previous lesson</q-tooltip>
            </q-btn>
            <q-btn flat icon="navigate_before" @click="beforeSentence">
              <q-tooltip>Previous sentence</q-tooltip>
            </q-btn>
            <q-btn v-if="player.sound.value && player.sound.value.playing()" flat icon="pause_circle"
              @click="togglePlay">
              <q-tooltip>Pause</q-tooltip>
            </q-btn>
            <q-btn v-else flat icon="play_circle" @click="togglePlay">
              <q-tooltip>Play</q-tooltip>
            </q-btn>

            <q-btn flat icon="navigate_next" @click="nextSentence">
              <q-tooltip>Next sentence</q-tooltip>
            </q-btn>
            <q-btn flat icon="skip_next" @click="next">
              <q-tooltip>Next lesson</q-tooltip>
            </q-btn>
          </div>
        </q-toolbar>

        <q-btn flat class="col-2" @click="toggleRightDrawer" dense icon="reorder" />
      </div>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, reactive, ref } from "vue";
import { parseLRC } from "../utils/lyrics-util";
import { Howl, Howler } from "howler";

const rightDrawerOpen = ref(true);
const toggleRightDrawer = () => {
  rightDrawerOpen.value = !rightDrawerOpen.value;
};

const lessons = ref([]);

onMounted(() => {
  window.fileAPI.onOpenFolder((values) => {
    lessons.value = values;
    localStorage.setItem("lessons", JSON.stringify(values));
  });
  loadLocalLessons();
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
        this.parsedSentences.value = parseLRC(content);
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
function playLesson(lesson) {
  player.playLesson(lesson);
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

  if (lessons.value.indexOf(player.currentLesson) > 0) {
    playLesson(lessons.value[lessons.value.indexOf(player.currentLesson) - 1]);
  } else {
    playLesson(lessons.value[lessons.value.length - 1]);
  }
}

function next() {
  if (player.sound.value.playing()) {
    player.sound.value.pause();
  }

  if (lessons.value.indexOf(player.currentLesson) < lessons.value.length - 1) {
    playLesson(lessons.value[lessons.value.indexOf(player.currentLesson) + 1]);
  } else {
    playLesson(lessons.value[0]);
  }
}
</script>
<style>
body {
  font-family: Arial, sans-serif;
  text-align: center;
  font-size: medium;
}

#sentences {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sentence {
  cursor: pointer;
}
</style>
