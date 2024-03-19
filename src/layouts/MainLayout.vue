<template>
  <q-layout view="hHh lpR fFr" class="electron">
    <q-page-container>
      <audio id="player">Player</audio>
      <div id="sentences">
        <q-list class="sentence" v-for="s in parsedSentences" :key="s" @click="clickSentence(s)">
          <q-item clickable v-ripple>
            <q-item-section :id="s.start" v-if="currentSentence === s" class="text-primary">
              {{ s.text }}
            </q-item-section>
            <q-item-section v-else>
              {{ s.text }}
            </q-item-section>
          </q-item>

        </q-list>
      </div>

    </q-page-container>
    <q-drawer show-if-above v-model="rightDrawerOpen" side="right" behavior="desktop" bordered>
      <q-list dense bordered>
        <q-item clickable v-ripple v-for="lesson in lessons" :key="lesson.name" @click="openFile(lesson)">
          <q-item-section>
            <q-item-label>{{ lesson.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>
    <q-footer elevated class="bg-grey-8 text-white">
      <q-toolbar>
        <div class="q-pa-md  ">
          <q-btn-group class="absolute-center">

            <q-btn push glossy label="prev" icon="skip_previous" @click="prev" />
            <q-btn push glossy label="before" icon="navigate_before" @click="beforeSentence" />

            <q-btn push glossy label="paly/pause" icon="play_circle" @click="togglePlay" />
            <q-btn push glossy label="next" icon="navigate_next" @click="nextSentence" />

            <q-btn push glossy label="next" icon="skip_next" @click="next" />

          </q-btn-group>

          <q-btn flat class="absolute-right" @click="toggleRightDrawer" dense icon="reorder" />
        </div>

      </q-toolbar>
    </q-footer>
  </q-layout>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
const rightDrawerOpen = ref(true)
const toggleRightDrawer = () => {
  rightDrawerOpen.value = !rightDrawerOpen.value
}
const folderPaths = ref([])
const lessons = ref([])
const currentSentence = ref(null)
const parsedSentences = ref([])
onMounted(() => {
  window.myAPI.onOpenFodler((values) => {
    lessons.value = values;
    localStorage.setItem('lessons', JSON.stringify(values));
  })
  loadLocalLessons()
})


const sound = ref(null)

function loadLocalLessons() {
  const localLessons = localStorage.getItem('lessons')
  if (localLessons) {
    lessons.value = JSON.parse(localLessons)
  }
}

function togglePlay() {
  if (sound.value.playing()) {
    sound.value.pause();
  } else {
    sound.value.play();
  }
}

const currentLesson = ref(null)


async function openFile(lesson) {
  currentLesson.value = lesson;
  const content = await window.myAPI.readFile(lesson.lyrics.path + '/' + lesson.lyrics.name)
  // const content = await readFileAsTextWithDetectedEncoding(file)
  parsedSentences.value = parseLRC(content)
  const audioFilePath = lesson.audio.path + '/' + lesson.audio.name

  sound.value = new Howl({
    src: [audioFilePath],
    html5: true,
    onload: function () {
      parsedSentences.value[parsedSentences.value.length - 1].end = sound.value.duration();
    },
    onplay: function () {
      requestAnimationFrame(step);
    }
  });

}
const isScrolling = ref(false)
function step() {
  if (!sound.value.playing() || isScrolling.value) {
    // If the audio is not playing, don't continue the animation loop.
    return;
  }

  var currentTime = sound.value.seek() || 0; // Get the current playback time
  for (var i = 0; i < parsedSentences.value.length; i++) {
    let sentence = parsedSentences.value[i]
    if (currentTime >= sentence.start && currentTime < sentence.end) { // Check if the current time has passed the timecode
      currentSentence.value = sentence;
      console.log(currentSentence.value)
      var element = document.getElementById(currentSentence.value.start);
      if (element) {
        if (!isElementInViewport(element)) {
          isScrolling.value = true;
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log("scrolling")
          setTimeout(function () {
            isScrolling.value = false;
            requestAnimationFrame(step); // Continue the loop while the sound is playing

          }, 300); // Assuming smooth scroll takes ~300ms to complete
        }
      }
      break
    }
  }


  // if (sound.value.playing()) {
  requestAnimationFrame(step); // Continue the loop while the sound is playing
  // }
}


// Helper function to check if an element is in the viewport.
// Helper function to check if an element is in the viewport.
function isElementInViewport(el) {
  var rect = el.getBoundingClientRect();
  var viewportHeight = (window.innerHeight || document.documentElement.clientHeight);

  // Adjust the bottom threshold by the height of the footer
  var adjustedBottom = viewportHeight - 50;

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= adjustedBottom && // Use the adjusted bottom threshold
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

const currentPause = ref(null);



function parseLRC(lrcContent) {
  const lines = lrcContent.split("\n");
  const sentences = [];

  lines.forEach((line) => {
    const match = line.trim().match(/^\[(\d{2}):(\d{2}\.\d{2,3})\](.*)$/);
    if (match) {
      const [, minutes, seconds, content] = match;
      const start = parseFloat(minutes) * 60 + parseFloat(seconds);
      const text = content.includes("^") ? content.replace("^", " - ") : content;
      sentences.push({ start, text });
    }
  });

  for (let i = 0; i < sentences.length - 1; i++) {
    sentences[i].end = sentences[i + 1].start;
  }
  return sentences;
}

function getAudioDuration(filePath) {
  return new Promise((resolve) => {
    const audio = new Audio(filePath);
    audio.addEventListener("loadedmetadata", () => resolve(audio.duration));
  });
}
import { Howl, Howler } from 'howler';

function clickSentence(sentence) {
  if (sound.value.playing()) {
    sound.value.pause();
  }
  currentSentence.value = sentence;
  sound.value.seek(sentence.start)
  sound.value.play();

  const duration = (sentence.end - sentence.start) * 1000;
  currentPause.value = setTimeout(() => {
    sound.value.pause();
  }, duration);
}

function beforeSentence() {
  // currentSentence.value = parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) - 1];
  if (parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) - 1]) {
    clearTimeout(currentPause.value);
    clickSentence(parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) - 1])
  }
}

function nextSentence() {
  // currentSentence.value = parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) + 1];
  if (parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) + 1]) {
    clearTimeout(currentPause.value);
    clickSentence(parsedSentences.value[parsedSentences.value.indexOf(currentSentence.value) + 1])
  }
}

function prev() {
  if (sound.value.playing()) {
    sound.value.pause();
  }

  if (lessons.value.indexOf(currentLesson.value) > 0) {
    openFile(lessons.value[lessons.value.indexOf(currentLesson.value) - 1])
  } else {
    openFile(lessons.value[lessons.value.length - 1])
  }
}

function next() {
  if (sound.value.playing()) {
    sound.value.pause();
  }

  if (lessons.value.indexOf(currentLesson.value) < lessons.value.length - 1) {
    openFile(lessons.value[lessons.value.indexOf(currentLesson.value) + 1])
  } else {
    openFile(lessons.value[0])
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

