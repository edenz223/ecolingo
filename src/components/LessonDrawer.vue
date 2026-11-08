<template>
  <q-drawer v-model="open" show-if-above :breakpoint="900" side="right" class="glass-drawer">
    <q-scroll-area class="fit">
      <q-list>
        <q-item-label header>课程列表</q-item-label>
        <q-item
          v-for="(lesson, index) in lessons"
          :key="lesson.name"
          clickable
          @click="emit('select', index)"
          :class="{
            'lesson-item': true,
            'lesson-item--active': currentIndex === index,
          }"
        >
          <q-item-section>
            <q-item-label>{{ lesson.name }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-scroll-area>
  </q-drawer>
</template>

<script setup lang="ts">
import type { Lesson } from '../types/recording';

const open = defineModel<boolean>({ required: true });
defineProps<{ lessons: Lesson[]; currentIndex: number }>();
const emit = defineEmits<{ (event: 'select', index: number): void }>();
</script>

<style>
.q-drawer {
  transition: box-shadow 0.2s;
}

.q-drawer--fixed {
  box-shadow: none !important;
}

.lesson-item {
  margin: 1px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  font-size: var(--text-body);
  line-height: 1.45;
  transition: background-color 120ms ease;
}

.lesson-item:hover {
  background: var(--bg-hover);
}

.lesson-item--active {
  color: var(--active-ink) !important;
  background: var(--active-bg) !important;
  font-weight: 600;
}

.lesson-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}
</style>
