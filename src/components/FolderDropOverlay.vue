<template>
  <div v-if="active" class="drop-overlay">
    <div class="drop-overlay__card">
      <q-icon name="folder_open" size="20px" />松开以打开课程文件夹
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

// Dropping a folder (or a file inside one) opens it; without preventDefault
// Electron would navigate the window to the dropped file.
const emit = defineEmits<{
  (event: 'open-path', path: string): void;
  (event: 'unreadable'): void;
}>();

const active = ref(false);
let dragDepth = 0;

function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function handleDragEnter(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  active.value = true;
}

function handleDragOver(event: DragEvent) {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(event: DragEvent) {
  if (!carriesFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) active.value = false;
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragDepth = 0;
  active.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  const droppedPath = window.fileAPI?.getPathForFile?.(file);
  if (droppedPath) emit('open-path', droppedPath);
  else emit('unreadable');
}

const listeners: [type: string, handler: (event: any) => void][] = [
  ['dragenter', handleDragEnter],
  ['dragover', handleDragOver],
  ['dragleave', handleDragLeave],
  ['drop', handleDrop],
];

onMounted(() => {
  for (const [type, handler] of listeners) window.addEventListener(type, handler);
});

onUnmounted(() => {
  for (const [type, handler] of listeners) window.removeEventListener(type, handler);
});
</script>

<style>
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 2200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--backdrop);
  pointer-events: none;
}

.drop-overlay__card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  color: var(--ink-strong);
  background: var(--bg-raised);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-body);
  font-weight: 500;
}
</style>
