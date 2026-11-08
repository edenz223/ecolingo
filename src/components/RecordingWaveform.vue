<template>
  <span
    class="recording-waveform"
    :class="{
      'recording-waveform--voice': voiceActive,
      'recording-waveform--restart': restarted,
    }"
    aria-hidden="true"
  >
    <span class="waveform-bar waveform-bar--1" />
    <span class="waveform-bar waveform-bar--2" />
    <span class="waveform-bar waveform-bar--3" />
  </span>
</template>

<script setup lang="ts">
// Re-key this component on each restart so the refresh animation replays.
defineProps<{ voiceActive: boolean; restarted: boolean }>();
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
  transition: height 120ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: height;
}

.waveform-bar--1,
.waveform-bar--3 {
  width: 3.5px;
  height: 7px;
}

.waveform-bar--2 {
  width: 4px;
  height: 9.5px;
}

.recording-waveform--voice .waveform-bar--1,
.recording-waveform--voice .waveform-bar--3 {
  height: 20px;
}

.recording-waveform--voice .waveform-bar--2 {
  height: 28px;
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
