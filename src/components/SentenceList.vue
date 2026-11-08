<template>
  <div
    id="sentences"
    ref="panel"
    class="q-pa-md sentences-panel"
    :class="{ 'sentences-panel--switching': switching }"
    @wheel.passive="emit('browse')"
    @touchmove.passive="emit('browse')"
    @keydown="moveFocus"
  >
    <q-list>
      <q-item
        v-for="s in sentences"
        :key="s.start"
        clickable
        class="sentence-item"
        active-class="sentence-item--active"
        :class="{
          'sentence-preview': previewClipId && recordings[s.start]?.id === previewClipId,
          [`sentence-item--${status?.tone}`]: currentSentence === s && status?.visible,
        }"
        @click="emit('sentence-click', s, $event)"
        @dblclick="emit('sentence-dblclick', s)"
        :active="!previewClipId && currentSentence === s"
      >
        <q-item-section>
          <q-item-label :id="s.start.toString()">{{ s.text }}</q-item-label>
          <!-- Status sits under the sentence being read so the eyes never leave it.
               The line stays reserved while idle so starting or pausing does not shift the list. -->
          <div
            v-if="currentSentence === s && status?.visible"
            class="sentence-status"
            :class="{ 'sentence-status--idle': status.tone === 'idle' }"
          >
            <PracticeStatusLine :status="status" />
          </div>
        </q-item-section>
        <q-item-section
          v-if="recordings[s.start] && !isRecording && noSpeechSentence !== s.start"
          side
          class="sentence-actions"
        >
          <q-btn
            round
            dense
            flat
            class="sentence-recording-button"
            :icon="compareSentenceStart === s.start ? 'stop_circle' : 'compare_arrows'"
            :color="compareSentenceStart === s.start ? 'primary' : undefined"
            :aria-label="compareSentenceStart === s.start ? '停止对比' : '对比原声与我的录音'"
            @click.stop="emit('compare', s)"
          >
            <q-tooltip
              :delay="400"
              :hide-delay="0"
              :transition-duration="100"
              class="small-tooltip"
              >{{ compareSentenceStart === s.start ? '停止对比' : '对比原声与录音 · B' }}</q-tooltip
            >
          </q-btn>
          <q-btn
            v-if="compareSentenceStart !== s.start"
            round
            dense
            flat
            class="sentence-recording-button"
            :icon="previewClipId === recordings[s.start].id ? 'stop_circle' : 'play_circle'"
            :color="previewClipId === recordings[s.start].id ? 'primary' : undefined"
            :aria-label="previewClipId === recordings[s.start].id ? '停止回放' : '播放此句最新录音'"
            @click.stop="emit('play-recording', s.start)"
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
        <q-item-section v-else side class="sentence-actions" />
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PracticeStatusLine from './PracticeStatus.vue';
import type { PracticeStatus } from '../utils/practice-status';
import type { RecordingClip } from '../types/recording';
import type { Sentence } from '../types/subtitles';

defineProps<{
  sentences: Sentence[];
  currentSentence: Sentence | null | undefined;
  recordings: Record<number, RecordingClip>;
  previewClipId: string | null;
  isRecording: boolean;
  noSpeechSentence: number | null;
  // Sentence whose original/take comparison is running, if any.
  compareSentenceStart: number | null;
  // The next lesson is loading; this list is about to be replaced.
  switching?: boolean;
  status?: PracticeStatus;
}>();
const emit = defineEmits<{
  (event: 'sentence-click', sentence: Sentence, domEvent: MouseEvent): void;
  (event: 'sentence-dblclick', sentence: Sentence): void;
  (event: 'play-recording', start: number): void;
  (event: 'compare', sentence: Sentence): void;
  // The user scrolled the list by hand, so stop following playback.
  (event: 'browse'): void;
}>();

const panel = ref<HTMLElement | null>(null);

// Up/Down move focus between sentences; Enter on a focused sentence plays it.
function moveFocus(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const item = (event.target as HTMLElement | null)?.closest<HTMLElement>('.sentence-item');
  if (!item || !panel.value) return;
  const items = Array.from(panel.value.querySelectorAll<HTMLElement>('.sentence-item'));
  const next = items[items.indexOf(item) + (event.key === 'ArrowDown' ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
  next.scrollIntoView({ block: 'nearest' });
}
</script>

<style>
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

/* Fade only if loading takes noticeable time, so quick switches stay still. */
.sentences-panel--switching {
  opacity: 0.45;
  pointer-events: none;
  transition: opacity 150ms ease 150ms;
}

.sentences-panel--switching .sentence-actions > * {
  visibility: hidden;
}

@media (prefers-reduced-motion: reduce) {
  .sentences-panel--switching {
    transition: none;
  }
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

.sentence-item.sentence-item--active.sentence-item--recording {
  box-shadow: inset 2px 0 var(--recording-ink);
}

.sentence-item.sentence-item--active.sentence-item--warning {
  box-shadow: inset 2px 0 var(--warning-ink);
}

.sentence-status {
  margin-top: 2px;
  line-height: 1.5;
}

.sentence-status--idle {
  visibility: hidden;
}

.sentence-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* Fixed width so rows with and without takes wrap text the same way. */
.sentence-item .sentence-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 84px;
  width: 84px;
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
</style>
