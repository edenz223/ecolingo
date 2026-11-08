<template>
  <div
    id="sentences"
    class="q-pa-md sentences-panel"
    @wheel.passive="emit('browse')"
    @touchmove.passive="emit('browse')"
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
        }"
        @click="emit('sentence-click', s, $event)"
        @dblclick="emit('sentence-dblclick', s)"
        :active="!previewClipId && currentSentence === s"
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
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import type { RecordingClip } from '../types/recording';
import type { Sentence } from '../types/subtitles';

defineProps<{
  sentences: Sentence[];
  currentSentence: Sentence | null | undefined;
  recordings: Record<number, RecordingClip>;
  previewClipId: string | null;
  isRecording: boolean;
  noSpeechSentence: number | null;
}>();
const emit = defineEmits<{
  (event: 'sentence-click', sentence: Sentence, domEvent: MouseEvent): void;
  (event: 'sentence-dblclick', sentence: Sentence): void;
  (event: 'play-recording', start: number): void;
  // The user scrolled the list by hand, so stop following playback.
  (event: 'browse'): void;
}>();
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

.sentence-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
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
</style>
