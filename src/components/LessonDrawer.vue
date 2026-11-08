<template>
  <q-drawer v-model="open" show-if-above :breakpoint="900" side="right" class="glass-drawer">
    <div class="lesson-drawer">
      <div class="lesson-drawer__header">
        <div class="lesson-drawer__title">
          <span v-if="folderName" class="lesson-drawer__folder ellipsis" :title="folderName">{{
            folderName
          }}</span>
          <span v-else class="lesson-drawer__label">课程列表</span>
        </div>
        <q-btn
          flat
          round
          dense
          size="sm"
          icon="folder_open"
          class="lesson-drawer__open"
          aria-label="打开其他文件夹"
          @click="emit('open-folder')"
        >
          <HintTooltip>打开其他文件夹</HintTooltip>
        </q-btn>
      </div>
      <div v-if="lessons.length > filterThreshold" class="lesson-drawer__filter">
        <input
          v-model="query"
          type="search"
          class="lesson-drawer__input"
          placeholder="筛选课程"
          aria-label="筛选课程"
        />
      </div>
      <q-scroll-area class="lesson-drawer__list">
        <q-list>
          <q-item
            v-for="{ lesson, index } in visibleLessons"
            :key="lessonKey(lesson)"
            clickable
            @click="emit('select', index)"
            :class="{
              'lesson-item': true,
              'lesson-item--active': currentIndex === index,
            }"
          >
            <q-item-section>
              <q-item-label>{{ lesson.name }}</q-item-label>
              <q-item-label
                v-if="recordedCounts[lessonKey(lesson)]"
                class="lesson-item__count"
                :title="`已录 ${recordedCounts[lessonKey(lesson)]} 句`"
                ><q-icon name="mic" size="14px" aria-hidden="true" />{{
                  recordedCounts[lessonKey(lesson)]
                }}</q-item-label
              >
            </q-item-section>
          </q-item>
        </q-list>
        <div v-if="!lessons.length" class="lesson-drawer__empty">打开或拖入课程文件夹</div>
        <div v-else-if="!visibleLessons.length" class="lesson-drawer__empty">没有匹配的课程</div>
      </q-scroll-area>
    </div>
  </q-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import HintTooltip from './HintTooltip.vue';
import { filterLessons, lessonFolderName, lessonKey } from '../utils/lesson-library';
import type { Lesson } from '../types/recording';

// Long lists get a filter box; short ones stay uncluttered.
const filterThreshold = 15;

const open = defineModel<boolean>({ required: true });
const props = defineProps<{
  lessons: Lesson[];
  currentIndex: number;
  recordedCounts: Record<string, number>;
}>();
const emit = defineEmits<{
  (event: 'select', index: number): void;
  (event: 'open-folder'): void;
}>();

const query = ref('');
const folderName = computed(() => lessonFolderName(props.lessons));
const visibleLessons = computed(() => filterLessons(props.lessons, query.value));

watch(
  () => props.lessons,
  () => {
    query.value = '';
  }
);
</script>

<style>
.q-drawer {
  transition: box-shadow 0.2s;
}

.q-drawer--fixed {
  box-shadow: none !important;
}

.lesson-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.lesson-drawer__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 8px 16px;
}

.lesson-drawer__title {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.lesson-drawer__label {
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.lesson-drawer__folder {
  color: var(--ink-strong);
  font-size: var(--text-body);
  font-weight: 500;
}

.lesson-drawer__open {
  flex-shrink: 0;
  color: var(--ink-muted);
}

.lesson-drawer__filter {
  padding: 0 12px 8px;
}

.lesson-drawer__input {
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--ink);
  background: var(--bg-sunken);
  font-size: var(--text-body);
}

.lesson-drawer__input::placeholder {
  color: var(--ink-faint);
}

.lesson-drawer__input:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 0;
}

.lesson-drawer__list {
  flex: 1;
  min-height: 0;
}

.lesson-drawer__empty {
  padding: 12px 16px;
  color: var(--ink-muted);
  font-size: var(--text-caption);
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

.lesson-item .lesson-item__count {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: 400;
}

/* app.scss tints every label in the active lesson; soften the count there. */
.lesson-item--active .lesson-item__count {
  opacity: 0.75;
}
</style>
