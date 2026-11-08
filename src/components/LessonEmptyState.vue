<template>
  <div class="lesson-empty">
    <q-icon name="headphones" size="48px" color="primary" />
    <div class="text-h6">{{ title }}</div>
    <div class="text-grey-7 lesson-empty__detail">{{ detail }}</div>
    <q-btn
      unelevated
      color="primary"
      :icon="resume || lessonCount ? 'play_arrow' : 'folder_open'"
      :label="resume ? '继续练习' : lessonCount ? '从第一课开始' : '打开课程文件夹'"
      :loading="loading"
      @click="primaryAction"
    />
    <q-btn
      v-if="lessonCount && !loading"
      flat
      no-caps
      label="打开其他文件夹"
      class="lesson-empty__secondary"
      @click="emit('open-folder')"
    />
    <div class="lesson-empty__hint">也可以把课程文件夹拖到窗口里</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  loading: boolean;
  lessonCount: number;
  folderName: string;
  resume: { lessonName: string; sentenceNumber: number } | null;
}>();
const emit = defineEmits<{
  (event: 'resume'): void;
  (event: 'start'): void;
  (event: 'open-folder'): void;
}>();

const title = computed(() => {
  if (props.loading) return '正在打开课程…';
  if (props.resume) return '继续上次的练习';
  return props.lessonCount ? '选择一课开始' : '开始今天的跟读';
});

const detail = computed(() => {
  if (props.resume) return `${props.resume.lessonName} · 第 ${props.resume.sentenceNumber} 句`;
  if (props.lessonCount) return `${props.folderName} · 共 ${props.lessonCount} 课`;
  return '选择包含音频和字幕的文件夹';
});

function primaryAction() {
  if (props.resume) emit('resume');
  else if (props.lessonCount) emit('start');
  else emit('open-folder');
}
</script>

<style>
.lesson-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 2vh, 14px);
  text-align: center;
  max-width: 420px;
  width: 100%;
  margin: auto;
  padding: clamp(24px, 4vh, 40px) 28px;
  background: var(--bg-sunken);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.lesson-empty .text-h6 {
  font-family: var(--font-display);
  font-size: var(--text-title);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.lesson-empty .text-grey-7 {
  font-size: var(--text-body);
  line-height: 1.5;
  color: var(--ink-muted);
}

.lesson-empty > .q-icon {
  font-size: 36px !important;
  color: var(--ink-muted) !important;
}

.lesson-empty__detail {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.lesson-empty .lesson-empty__secondary {
  margin-top: -4px;
  color: var(--ink-muted);
}

.lesson-empty__hint {
  color: var(--ink-muted);
  font-size: var(--text-caption);
}
</style>
