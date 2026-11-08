<template>
  <div class="zen-stage">
    <div class="zen-neighbor" aria-hidden="true">{{ previous }}</div>
    <div class="zen-focus">
      <Transition name="zen-sentence" mode="out-in">
        <div :key="sentenceKey" class="zen-current">{{ current }}</div>
      </Transition>
      <!-- Right under the sentence; the space stays reserved so the sentence never moves. -->
      <div
        class="zen-status"
        :class="{ 'zen-status--idle': !status?.visible || status.tone === 'idle' }"
      >
        <PracticeStatusLine v-if="status?.visible" :status="status" />
      </div>
    </div>
    <div class="zen-neighbor" aria-hidden="true">{{ next }}</div>
  </div>
</template>

<script setup lang="ts">
import PracticeStatusLine from './PracticeStatus.vue';
import type { PracticeStatus } from '../utils/practice-status';

defineProps<{
  previous: string;
  current: string;
  next: string;
  // Changing the key replays the cross-fade between sentences.
  sentenceKey: number | undefined;
  status?: PracticeStatus;
}>();
</script>

<style>
.zen-stage {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 40px;
  margin: 0;
  padding: 40px 60px;
  text-align: center;
  overflow-wrap: anywhere;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.zen-focus {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.zen-status {
  display: flex;
  justify-content: center;
  min-height: 22px;
  max-width: calc(100vw - 32px);
}
.zen-status--idle {
  visibility: hidden;
}
.zen-current {
  font-family: var(--font-display);
  font-size: var(--text-zen);
  max-width: min(1100px, 92vw);
  line-height: 1.55;
  color: var(--ink-strong);
  font-weight: 500;
  letter-spacing: -0.015em;
}
.zen-neighbor {
  min-height: 2em;
  max-height: 3.2em;
  max-width: min(900px, 88vw);
  overflow: hidden;
  font-size: var(--text-zen-neighbor);
  line-height: 1.5;
  opacity: 0.4;
  filter: blur(2.5px);
  pointer-events: none;
  user-select: none;
}
.zen-sentence-enter-active,
.zen-sentence-leave-active {
  transition: opacity 150ms ease;
}
.zen-sentence-enter-from,
.zen-sentence-leave-to {
  opacity: 0;
}
</style>
