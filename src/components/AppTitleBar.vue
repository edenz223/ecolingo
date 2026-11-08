<template>
  <div class="system-titlebar" @dblclick="toggleMaximize">
    <div class="titlebar-leading">
      <span class="app-brand">EcoLingo</span>
      <button
        type="button"
        class="titlebar-menu-btn"
        aria-label="打开文件夹"
        @click.stop="emit('open-folder')"
      >
        文件
      </button>
      <button
        type="button"
        class="titlebar-menu-btn"
        aria-label="查看键盘快捷键"
        @click.stop="emit('show-shortcuts')"
      >
        帮助
      </button>
    </div>
    <div v-if="!isMac" class="window-controls">
      <button
        type="button"
        class="window-control-btn"
        aria-label="最小化"
        @click.stop="minimizeWindow"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        type="button"
        class="window-control-btn"
        :aria-label="isMaximized ? '还原' : '最大化'"
        @click.stop="toggleMaximize"
      >
        <svg
          v-if="isMaximized"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <path d="M2.5 1.5h6v6m-6 0v-6h6v6h-6z" />
        </svg>
        <svg
          v-else
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        >
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        type="button"
        class="window-control-btn window-control-btn--close"
        aria-label="关闭"
        @click.stop="closeWindow"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const emit = defineEmits<{
  (event: 'open-folder'): void;
  (event: 'show-shortcuts'): void;
}>();

const isMac = window.fileAPI?.platform === 'darwin';
const isMaximized = ref(false);

async function minimizeWindow() {
  await window.fileAPI?.minimize?.();
}

async function toggleMaximize() {
  const result = await window.fileAPI?.maximize?.();
  if (typeof result === 'boolean') {
    isMaximized.value = result;
  }
}

async function closeWindow() {
  await window.fileAPI?.close?.();
}

onMounted(() => {
  window.fileAPI?.isMaximized?.().then(val => {
    isMaximized.value = Boolean(val);
  });
  window.fileAPI?.onMaximizedChange?.((val: boolean) => {
    isMaximized.value = val;
  });
});
</script>
