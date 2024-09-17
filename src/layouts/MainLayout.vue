<template>
  <q-layout view="hHh lpR fFr" class="electron">
    <q-page-container>
      <audio id="player">Player</audio>
      <div id="sentences">
        <q-list
          class="sentence"
          v-for="s in player.parsedSentences.value"
          :key="s"
          @click="player.clickSentence(s)"
        >
          <q-item clickable v-ripple>
            <q-item-section
              :id="s.start.toString()"
              v-if="player.currentSentence.value === s"
              class="text-primary"
            >
              {{ s.text }}
            </q-item-section>
            <q-item-section :id="s.start.toString()" v-else>
              {{ s.text }}
            </q-item-section>
          </q-item>
        </q-list>
      </div>
    </q-page-container>
    <q-drawer
      show-if-above
      v-model="rightDrawerOpen"
      side="right"
      behavior="desktop"
      bordered
    >
      <q-list dense bordered>
        <q-item
          clickable
          v-ripple
          v-for="lesson in lessons"
          :key="lesson.name"
          @click="playLesson(lesson)"
        >
          <q-item-section>
            <q-item-label>{{ lesson.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
    <q-footer elevated class="bg-grey-8 text-white">
      <div class="q-pa-md">
        <div class="row">
          <q-btn
            flat
            class="col"
            @click="player.repeatOne.value = !player.repeatOne.value"
            dense
            :icon="
              player.repeatOne.value === true ? 'repeat_one_on' : 'repeat_one'
            "
          />

          <q-toolbar class="col-8">
            <q-btn
              push
              glossy
              label="prev"
              icon="skip_previous"
              @click="prev"
            />
            <q-btn
              push
              glossy
              label="before"
              icon="navigate_before"
              @click="beforeSentence"
            />

            <q-btn
              push
              glossy
              label="play/pause"
              icon="play_circle"
              @click="togglePlay"
            />
            <q-btn
              push
              glossy
              label="next"
              icon="navigate_next"
              @click="nextSentence"
            />

            <q-btn push glossy label="next" icon="skip_next" @click="next" />
          </q-toolbar>

          <q-btn
            flat
            class="col"
            @click="toggleRightDrawer"
            dense
            icon="reorder"
          />
        </div>
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
  window.myAPI.onOpenFodler((values) => {
    lessons.value = values;
    localStorage.setItem("lessons", JSON.stringify(values));
  });
  loadLocalLessons();
});

class Player {
  constructor() {
    this.prevSound = null;
    this.sound = null;
    this.currentLesson = null;
    this.currentSentence = ref(null);
    this.parsedSentences = ref([]);
    this.isScrolling = ref(false);
    this.currentPause = null;
    this.repeatOne = ref(false);
  }

  playLesson(lesson) {
    this.prevSound = this.sound;
    this.currentLesson = lesson;
    const lyricsPath = lesson.lyrics.path + "/" + lesson.lyrics.name;
    const audioFilePath = lesson.audio.path + "/" + lesson.audio.name;

    window.myAPI
      .readFile(lyricsPath)
      .then((content) => {
        this.parsedSentences.value = parseLRC(content);
        return this.initializeSound(audioFilePath);
      })
      .then(() => {
        // 音频初始化完成后的操作
        console.log("课程加载完成");
        if (this.prevSound) {
          this.prevSound.pause();
        }
        this.clickSentence(this.parsedSentences.value[0]);
      })
      .catch((error) => {
        console.error("加载课程时出错:", error);
        // 这里可以添加错误处理逻辑，比如显示错误消息给用户
      });
  }

  initializeSound(audioFilePath) {
    return new Promise((resolve, reject) => {
      this.sound = new Howl({
        src: [audioFilePath],
        html5: true,
        onload: () => {
          this.parsedSentences.value[
            this.parsedSentences.value.length - 1
          ].end = this.sound.duration();
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
    console.log("togglePlay");
    if (this.sound.playing()) {
      this.sound.pause();
    } else {
      this.sound.play();
    }
  }

  step() {
    if (!this.sound.playing()) {
      return;
    }

    if (this.isScrolling.value) {
      requestAnimationFrame(this.step.bind(this));
      return;
    }

    var currentTime = this.sound.seek() || 0;

    if (
      this.currentSentence.value &&
      currentTime >= this.currentSentence.value.end &&
      this.repeatOne.value
    ) {
      this.sound.seek(this.currentSentence.value.start);
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
      console.log("scrollIntoView");
      this.isScrolling.value = true;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        this.isScrolling.value = false;
        console.log("scrollIntoView end");
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
    if (!this.sound) return;
    this.stopCurrentPlayback();
    this.currentSentence.value = sentence;
    this.sound.seek(sentence.start);
    this.sound.play();
  }

  stopCurrentPlayback() {
    if (this.sound.playing()) {
      this.sound.pause();
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
  if (player.sound.playing()) {
    player.sound.pause();
  }

  if (lessons.value.indexOf(player.currentLesson) > 0) {
    playLesson(lessons.value[lessons.value.indexOf(player.currentLesson) - 1]);
  } else {
    playLesson(lessons.value[lessons.value.length - 1]);
  }
}

function next() {
  if (player.sound.playing()) {
    player.sound.pause();
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
