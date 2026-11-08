<template>
  <q-footer
    class="glass-footer"
    :class="{
      'focus-footer': focusMode,
      'controls-menu-open': menuOpen,
    }"
  >
    <Transition name="focus-recording">
      <q-btn
        v-if="focusMode && isRecording"
        round
        unelevated
        size="lg"
        class="focus-recording-btn primary-play primary-play--recording"
        aria-label="正在录音，点击停止"
        @click="emit('toggle-play')"
      >
        <RecordingWaveform
          :key="recordingRevision"
          :voice-active="recordingVoiceActive"
          :restarted="recordingRevision > 0"
        />
        <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
          >录音中 · 空格停止 · R 重录</q-tooltip
        >
      </q-btn>
    </Transition>
    <q-toolbar class="wrap playback-toolbar">
      <div class="sentence-navigation">
        <q-btn
          flat
          round
          class="transport-button"
          icon="skip_previous"
          aria-label="上一句"
          :disable="!hasSentence"
          @click="emit('previous-sentence')"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >上一句 · A</q-tooltip
          >
        </q-btn>
        <q-btn
          round
          unelevated
          :color="isRecording ? undefined : 'primary'"
          size="lg"
          class="primary-play"
          :class="{ 'primary-play--recording': isRecording }"
          :disable="!hasSentence"
          :aria-label="isRecording ? '正在录音，点击停止' : isPlaying ? '暂停' : '播放'"
          :icon="isRecording ? undefined : isPlaying ? 'pause' : 'play_arrow'"
          @click="emit('toggle-play')"
        >
          <RecordingWaveform
            v-if="isRecording"
            :key="recordingRevision"
            :voice-active="recordingVoiceActive"
            :restarted="recordingRevision > 0"
          />
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >{{ isRecording ? '录音中，R 重录' : isPlaying ? '暂停' : '播放' }} · 空格</q-tooltip
          >
        </q-btn>
        <q-btn
          flat
          round
          class="transport-button"
          icon="skip_next"
          aria-label="下一句"
          :disable="!hasSentence"
          @click="emit('next-sentence')"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >下一句 · D</q-tooltip
          >
        </q-btn>
      </div>

      <div class="practice-controls">
        <button
          type="button"
          class="ios-switch-control"
          role="switch"
          aria-label="跟读"
          :aria-checked="shadowingMode"
          :disabled="!hasLesson"
          @click="emit('toggle-shadowing')"
        >
          <span class="ios-switch" aria-hidden="true"><span class="ios-switch__thumb" /></span>
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >{{ shadowingMode ? '关闭跟读' : '开启跟读' }} · S</q-tooltip
          >
        </button>
        <span v-if="!shadowingMode" class="practice-label">跟读</span>
        <q-btn
          v-if="shadowingMode"
          flat
          dense
          no-caps
          label="跟读"
          icon-right="expand_less"
          class="practice-method-btn"
          :disable="!hasLesson"
          aria-label="跟读：选择练习方式"
          aria-haspopup="menu"
          :aria-expanded="practiceMenuVisible"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >练习方式：{{
              practiceMethods.find(method => method.id === practiceMethod)?.label || '选择练习方式'
            }}</q-tooltip
          >
          <q-menu
            v-model="practiceMenuVisible"
            :no-refocus="pointerInteraction"
            class="practice-menu"
            anchor="top left"
            self="bottom left"
          >
            <q-list dense>
              <q-item-label header>练习方式</q-item-label>
              <q-item
                v-for="method in practiceMethods"
                :key="method.id"
                clickable
                v-close-popup
                :active="practiceMethod === method.id"
                @click="selectPracticeMethod(method.id)"
              >
                <q-item-section>
                  <q-item-label>{{ method.label }}</q-item-label>
                </q-item-section>
                <q-item-section side
                  ><q-icon v-if="practiceMethod === method.id" name="check"
                /></q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </div>
      <div class="playback-options">
        <q-btn
          flat
          round
          :icon="focusMode ? 'fullscreen_exit' : 'fullscreen'"
          :aria-label="focusMode ? '退出专注显示' : '专注显示'"
          :aria-pressed="focusMode"
          :disable="!hasSentence"
          @click="toggleFocusMode"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100">{{
            focusMode ? '退出专注显示' : '专注显示'
          }}</q-tooltip>
        </q-btn>
        <q-btn
          flat
          dense
          class="loop-mode-control"
          :icon="loopMode === 'one' ? 'repeat_one' : 'repeat'"
          :color="loopMode !== 'off' ? 'primary' : undefined"
          :disable="!hasLesson"
          :aria-label="'循环模式：' + loopModeDescription"
        >
          <q-menu v-model="loopMenuVisible" :no-refocus="pointerInteraction">
            <LoopModeList
              :loop-mode="loopMode"
              :repeat-count="repeatCount"
              @select="emit('select-loop-mode', $event)"
              @repeat-change="emit('repeat-change', $event)"
            />
          </q-menu>
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >循环模式</q-tooltip
          >
        </q-btn>

        <q-btn
          flat
          dense
          :label="formatPlaybackRate(playbackRate) + 'x'"
          class="playback-rate-control"
          aria-label="播放速度"
          :disable="!hasLesson"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100"
            >播放速度 · C / X 调整，Z 重置</q-tooltip
          >
          <q-menu
            v-model="playbackRateMenuVisible"
            :no-refocus="pointerInteraction"
            anchor="top right"
            self="bottom right"
            :offset="[10, 0]"
            class="q-pa-sm"
          >
            <PlaybackRateList :rate="playbackRate" @select="emit('select-rate', $event)" />
          </q-menu>
        </q-btn>

        <q-btn
          flat
          round
          icon="more_horiz"
          class="more-options-control"
          aria-label="更多播放选项"
          aria-haspopup="menu"
          :aria-expanded="moreMenuVisible"
          :disable="!hasLesson"
        >
          <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
            >{{ loopModeDescription }} · {{ formatPlaybackRate(playbackRate) }}x</q-tooltip
          >
          <q-menu
            v-model="moreMenuVisible"
            :no-refocus="pointerInteraction"
            anchor="top right"
            self="bottom right"
            class="more-options-menu"
          >
            <q-item-label header>循环模式</q-item-label>
            <LoopModeList
              :loop-mode="loopMode"
              :repeat-count="repeatCount"
              @select="emit('select-loop-mode', $event)"
              @repeat-change="emit('repeat-change', $event)"
            />
            <q-item-label header>播放速度</q-item-label>
            <PlaybackRateList :rate="playbackRate" @select="emit('select-rate', $event)" />
          </q-menu>
        </q-btn>
      </div>
    </q-toolbar>
  </q-footer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LoopModeList from './LoopModeList.vue';
import PlaybackRateList from './PlaybackRateList.vue';
import RecordingWaveform from './RecordingWaveform.vue';
import { practiceMethods } from '../modules/zen';
import { describeLoopMode, formatPlaybackRate } from '../utils/playback-options';
import type { LoopMode, PracticeMethod } from '../types/settings';

const props = defineProps<{
  focusMode: boolean;
  hasLesson: boolean;
  hasSentence: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  recordingRevision: number;
  recordingVoiceActive: boolean;
  shadowingMode: boolean;
  practiceMethod: PracticeMethod;
  loopMode: LoopMode;
  repeatCount: number;
  playbackRate: number;
  // Skip restoring focus to the trigger when a menu was opened with the pointer.
  pointerInteraction: boolean;
}>();
const emit = defineEmits<{
  (event: 'toggle-play'): void;
  (event: 'previous-sentence'): void;
  (event: 'next-sentence'): void;
  (event: 'toggle-shadowing'): void;
  (event: 'select-practice-method', method: PracticeMethod): void;
  (event: 'toggle-focus'): void;
  (event: 'select-loop-mode', mode: LoopMode): void;
  (event: 'repeat-change', count: number): void;
  (event: 'select-rate', rate: number): void;
  // Mirrors whether any menu is open so the layout can block shortcuts.
  (event: 'update:menuOpen', open: boolean): void;
}>();

const practiceMenuVisible = ref(false);
const loopMenuVisible = ref(false);
const playbackRateMenuVisible = ref(false);
const moreMenuVisible = ref(false);
const menuOpen = computed(
  () =>
    practiceMenuVisible.value ||
    loopMenuVisible.value ||
    playbackRateMenuVisible.value ||
    moreMenuVisible.value
);
const loopModeDescription = computed(() => describeLoopMode(props.loopMode, props.repeatCount));

watch(menuOpen, open => emit('update:menuOpen', open), { flush: 'sync' });
watch(
  () => props.shadowingMode,
  () => {
    practiceMenuVisible.value = false;
  }
);

function closeMenus() {
  practiceMenuVisible.value = false;
  loopMenuVisible.value = false;
  playbackRateMenuVisible.value = false;
  moreMenuVisible.value = false;
}

function selectPracticeMethod(method: PracticeMethod) {
  practiceMenuVisible.value = false;
  playbackRateMenuVisible.value = false;
  emit('select-practice-method', method);
}

function toggleFocusMode() {
  playbackRateMenuVisible.value = false;
  moreMenuVisible.value = false;
  emit('toggle-focus');
}

defineExpose({ closeMenus });
</script>

<style>
.playback-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  padding: 8px 12px;
}

.sentence-navigation {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
}

.transport-button {
  color: var(--ink);
}

.primary-play {
  border-radius: 50% !important;
  width: 48px !important;
  height: 48px !important;
  min-width: 48px !important;
  min-height: 48px !important;
  max-width: 48px !important;
  max-height: 48px !important;
  padding: 0 !important;
  aspect-ratio: 1 / 1 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: var(--shadow-sm) !important;
  flex-shrink: 0 !important;
}

.primary-play .q-btn__content {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.primary-play--recording {
  background-color: #de5555 !important;
  color: #ffffff !important;
  box-shadow: 0 2px 8px rgba(222, 85, 85, 0.32) !important;
  transition: background-color 200ms ease, box-shadow 200ms ease;
}

.primary-play--recording:hover {
  background-color: #d14747 !important;
}

.primary-play--recording:active {
  background-color: #c43c3c !important;
}

.focus-recording-btn {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2010;
  transition: opacity 160ms ease;
}

.focus-recording-enter-active,
.focus-recording-leave-active {
  transition: opacity 200ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.focus-recording-enter-from,
.focus-recording-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px) scale(0.92);
}

.focus-recording-enter-to,
.focus-recording-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .focus-recording-enter-active,
  .focus-recording-leave-active {
    transition: opacity 100ms ease !important;
    transform: translateX(-50%) !important;
  }
}

.practice-label {
  padding: 0 4px;
  color: var(--ink);
  font-size: var(--text-control);
  font-weight: 500;
}

.practice-method-btn {
  height: 28px;
  min-height: 28px;
  color: var(--ink);
  transition: color 120ms ease, background-color 120ms ease;
}

.practice-method-btn:hover {
  color: var(--ink-strong);
  background: var(--bg-hover);
}

.practice-method-btn .q-icon {
  font-size: 20px;
  margin-left: 2px;
  color: var(--ink-muted);
}

.playback-rate-control {
  min-width: 50px;
}

.more-options-control {
  display: none;
}

.more-options-menu {
  width: 220px;
  max-width: 90vw;
}

.more-options-menu .q-item__label--header {
  padding: 8px 12px 2px;
}

.practice-controls,
.playback-options {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 4px;
  min-height: 40px;
  padding: 4px;
  overflow: hidden;
}
.practice-controls {
  grid-column: 1;
  grid-row: 1;
  justify-self: start;
}
.playback-options {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  justify-content: flex-end;
}
.practice-menu {
  width: 180px;
  max-width: 90vw;
}

.practice-menu .q-item__label:not(.q-item__label--caption) {
  font-size: var(--text-body);
  font-weight: 500;
}

.ios-switch-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 4px 6px;
  color: var(--ink);
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
}

.ios-switch-control:hover {
  background: var(--bg-hover);
}

.ios-switch-control:disabled {
  cursor: default;
  opacity: 0.4;
}

.ios-switch {
  position: relative;
  width: 38px;
  height: 22px;
  background: var(--bg-sunken);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  transition: background-color 150ms ease;
}

.ios-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}

.ios-switch-control[aria-checked='true'] .ios-switch {
  background: var(--accent);
  border-color: var(--accent);
}

.ios-switch-control[aria-checked='true'] .ios-switch__thumb {
  transform: translateX(16px);
}

@media (max-width: 600px) {
  .loop-mode-control,
  .playback-rate-control {
    display: none;
  }

  .more-options-control {
    display: inline-flex;
  }
}
</style>
