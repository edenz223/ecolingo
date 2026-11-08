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
        aria-label="视图设置"
        aria-haspopup="menu"
        :aria-expanded="viewMenuOpen"
        @dblclick.stop
      >
        视图
        <q-menu
          v-model="viewMenuOpen"
          anchor="bottom left"
          self="top left"
          :offset="[0, 4]"
          class="view-menu"
        >
          <q-list dense>
            <q-item-label header>外观</q-item-label>
            <q-item
              v-for="option in themeOptions"
              :key="option.id"
              clickable
              :active="theme === option.id"
              @click="emit('select-theme', option.id)"
            >
              <q-item-section>{{ option.label }}</q-item-section>
              <q-item-section side
                ><q-icon v-if="theme === option.id" name="check" size="18px"
              /></q-item-section>
            </q-item>
            <q-item-label header>字幕字号</q-item-label>
            <q-item
              v-for="option in subtitleSizeOptions"
              :key="option.id"
              clickable
              :active="subtitleSize === option.id"
              @click="emit('select-subtitle-size', option.id)"
            >
              <q-item-section>{{ option.label }}</q-item-section>
              <q-item-section side
                ><q-icon v-if="subtitleSize === option.id" name="check" size="18px"
              /></q-item-section>
            </q-item>
          </q-list>
        </q-menu>
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
import { onMounted, ref, watch } from 'vue';
import type { SubtitleSize, ThemePreference } from '../types/settings';

defineProps<{ theme: ThemePreference; subtitleSize: SubtitleSize }>();
const emit = defineEmits<{
  (event: 'open-folder'): void;
  (event: 'show-shortcuts'): void;
  (event: 'select-theme', theme: ThemePreference): void;
  (event: 'select-subtitle-size', size: SubtitleSize): void;
  // Lets the layout pause space / R shortcuts while the menu is open.
  (event: 'update:menuOpen', open: boolean): void;
}>();

const themeOptions: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: '跟随系统' },
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
];
const subtitleSizeOptions: { id: SubtitleSize; label: string }[] = [
  { id: 'small', label: '小' },
  { id: 'medium', label: '中' },
  { id: 'large', label: '大' },
];

// Stays open after a choice so sizes can be compared in place.
const viewMenuOpen = ref(false);
watch(viewMenuOpen, open => emit('update:menuOpen', open), { flush: 'sync' });

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

<style>
.view-menu {
  width: 160px;
}
</style>
