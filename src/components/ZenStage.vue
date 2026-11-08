<template>
  <div class="zen-stage">
    <div class="zen-neighbor" aria-hidden="true">{{ previous }}</div>
    <Transition name="zen-sentence" mode="out-in">
      <div :key="sentenceKey" class="zen-current">{{ current }}</div>
    </Transition>
    <div class="zen-neighbor" aria-hidden="true">{{ next }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  previous: string;
  current: string;
  next: string;
  // Changing the key replays the cross-fade between sentences.
  sentenceKey: number | undefined;
}>();
</script>

<style>
.zen-stage {
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
.zen-current {
  font-family: var(--font-display);
  font-size: clamp(34px, 4.6vw, 56px);
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
  font-size: clamp(17px, 2.2vw, 26px);
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
