<template>
  <q-list>
    <q-item
      v-for="mode in loopModes"
      :key="mode.id"
      clickable
      v-close-popup
      :active="loopMode === mode.id"
      @click="emit('select', mode.id)"
    >
      <q-item-section>
        <div v-if="mode.id === 'one'" class="repeat-option">
          <span>{{ mode.label }}</span>
          <span class="repeat-stepper" @click.stop>
            <button
              type="button"
              class="stepper-button"
              aria-label="减少循环次数"
              :disabled="repeatCount <= 0"
              @click="emit('repeat-change', repeatCount - 1)"
            >
              −
            </button>
            <input
              aria-label="单句循环次数"
              title="0 或 ∞ 表示无限循环"
              type="text"
              inputmode="numeric"
              class="repeat-input"
              :value="repeatLabel"
              @keydown.stop
              @change="changeRepeatCount"
              @wheel.stop.prevent="scrollRepeatCount"
            />
            <button
              type="button"
              class="stepper-button"
              aria-label="增加循环次数"
              :disabled="repeatCount >= 99"
              @click="emit('repeat-change', repeatCount + 1)"
            >
              +
            </button>
          </span>
          <span>次</span>
        </div>
        <template v-else>{{ mode.label }}</template>
      </q-item-section>
      <q-item-section side v-if="loopMode === mode.id"><q-icon name="check" /></q-item-section>
    </q-item>
  </q-list>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue';
import { loopModes } from '../utils/playback-options';
import type { LoopMode } from '../types/settings';

const props = defineProps<{ loopMode: LoopMode; repeatCount: number }>();
const emit = defineEmits<{
  (event: 'select', mode: LoopMode): void;
  (event: 'repeat-change', count: number): void;
}>();

const repeatLabel = computed(() => (props.repeatCount === 0 ? '∞' : String(props.repeatCount)));

async function changeRepeatCount(event: Event) {
  const input = event.target as HTMLInputElement;
  const text = input.value.trim();
  const count = text === '' || text === '∞' ? 0 : Number(text);
  if (Number.isFinite(count)) emit('repeat-change', count);
  await nextTick();
  input.value = repeatLabel.value;
}

function scrollRepeatCount(event: WheelEvent) {
  if (!event.deltaY) return;
  emit('repeat-change', props.repeatCount + (event.deltaY < 0 ? 1 : -1));
}
</script>

<style scoped>
.repeat-option {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.repeat-stepper {
  display: inline-flex;
  align-items: center;
  height: 26px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--bg-base);
  overflow: hidden;
}

.stepper-button {
  width: 22px;
  height: 100%;
  padding: 0;
  border: 0;
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

.repeat-input {
  width: 2.4em;
  height: 100%;
  padding: 0;
  border: 0;
  border-inline: 1px solid var(--border);
  color: var(--ink-strong);
  background: transparent;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.repeat-input:focus-visible,
.stepper-button:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}
</style>
