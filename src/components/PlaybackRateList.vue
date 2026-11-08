<template>
  <q-list dense>
    <div class="rate-stepper">
      <button
        type="button"
        class="stepper-button"
        aria-label="减速 0.1 倍"
        :disabled="rate <= minPlaybackRate"
        @click="emit('select', rate - playbackRateStep)"
      >
        −
      </button>
      <span class="rate-value">{{ formatPlaybackRate(rate) }}x</span>
      <button
        type="button"
        class="stepper-button"
        aria-label="加速 0.1 倍"
        :disabled="rate >= maxPlaybackRate"
        @click="emit('select', rate + playbackRateStep)"
      >
        +
      </button>
    </div>
    <q-separator class="rate-separator" />
    <q-item
      v-for="preset in playbackRates"
      :key="preset"
      clickable
      v-close-popup
      :active="isSameRate(rate, preset)"
      @click="emit('select', preset)"
    >
      <q-item-section>{{ preset }} 倍</q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import {
  formatPlaybackRate,
  isSameRate,
  maxPlaybackRate,
  minPlaybackRate,
  playbackRateStep,
  playbackRates,
} from '../utils/playback-options';

defineProps<{ rate: number }>();
const emit = defineEmits<{ (event: 'select', rate: number): void }>();
</script>

<style scoped>
.rate-stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px;
}

.stepper-button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  color: var(--ink-muted);
  background: transparent;
  cursor: pointer;
}

.stepper-button:hover:not(:disabled) {
  color: var(--ink-strong);
  background: var(--bg-hover);
}

.stepper-button:disabled {
  color: var(--ink-faint);
  cursor: default;
}

.stepper-button:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}

.rate-value {
  min-width: 3.5em;
  color: var(--ink-strong);
  font-size: var(--text-control);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.rate-separator {
  margin: 2px 0;
  background: var(--border);
}
</style>
