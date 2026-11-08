<template>
  <span
    class="recording-waveform"
    :class="{ 'recording-waveform--restart': restarted }"
    aria-hidden="true"
  >
    <span class="waveform-bar waveform-bar--side" :style="{ height: heights[0] }" />
    <span class="waveform-bar waveform-bar--center" :style="{ height: heights[1] }" />
    <span class="waveform-bar waveform-bar--side" :style="{ height: heights[2] }" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

// Re-key this component on each restart so the refresh animation replays.
const props = defineProps<{ level: number; restarted: boolean }>();

const side = { rest: 7, peak: 20 };
const center = { rest: 9.5, peak: 28 };
const reducedMotion =
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Recent levels, newest first (one per ~20 ms detector frame). The side bars
// replay the centre a few frames late, so each syllable ripples outward.
const history = ref<number[]>([]);
watch(
  () => props.level,
  level => {
    history.value = [level, ...history.value].slice(0, 6);
  }
);

function height(size: { rest: number; peak: number }, value: number) {
  return `${size.rest + (size.peak - size.rest) * value}px`;
}

const heights = computed(() => {
  if (reducedMotion) {
    // No continuous motion: one fixed step while the voice is heard.
    const value = props.level > 0 ? 0.6 : 0;
    return [height(side, value), height(center, value), height(side, value)];
  }
  const past = history.value;
  return [
    height(side, (past[2] ?? 0) * 0.9),
    height(center, props.level),
    height(side, (past[5] ?? 0) * 0.8),
  ];
});
</script>

<style>
.recording-waveform {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3.5px;
  height: 32px;
  pointer-events: none;
}

.recording-waveform--restart {
  animation: recording-restart 280ms ease-out;
}

@keyframes recording-restart {
  from {
    opacity: 0.4;
    transform: scaleY(0.65);
  }
  to {
    opacity: 1;
    transform: scaleY(1);
  }
}

.waveform-bar {
  display: block;
  background-color: #ffffff;
  border-radius: 999px;
  transform-origin: center;
  /* The detector updates every ~20 ms; a short ease keeps steps smooth. */
  transition: height 80ms ease-out;
  will-change: height;
}

.waveform-bar--side {
  width: 3.5px;
  height: 7px;
}

.waveform-bar--center {
  width: 4px;
  height: 9.5px;
}

@media (prefers-reduced-motion: reduce) {
  .recording-waveform--restart {
    animation: none;
  }
  .waveform-bar {
    transition: none !important;
  }
}
</style>
