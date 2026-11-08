<template>
  <div class="lesson-heading">
    <div v-if="sentenceCount" class="lesson-progress">
      <div class="ellipsis">{{ lessonName }}</div>
      <span v-if="!switching" class="lesson-count"
        >{{ sentencePosition }} / {{ sentenceCount }}</span
      >
    </div>
    <q-btn
      v-if="!following && sentenceCount"
      flat
      round
      dense
      size="sm"
      color="primary"
      icon="my_location"
      aria-label="回到当前句"
      class="follow-btn"
      @click="emit('resume-following')"
    >
      <q-tooltip :delay="400" :hide-delay="0" :transition-duration="100" class="small-tooltip"
        >回到当前句</q-tooltip
      >
    </q-btn>
    <q-btn
      flat
      round
      dense
      class="top-action top-sidebar-toggle"
      size="sm"
      aria-label="显示或隐藏课程列表"
      :aria-expanded="drawerOpen"
      @click="toggleDrawer"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M16 4v16" />
      </svg>
      <q-tooltip
        ref="drawerTooltipRef"
        :delay="400"
        :hide-delay="0"
        :transition-duration="100"
        class="small-tooltip"
        >显示或隐藏课程列表</q-tooltip
      >
    </q-btn>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { QTooltip } from 'quasar';

defineProps<{
  lessonName: string;
  sentencePosition: number;
  sentenceCount: number;
  following: boolean;
  // The next lesson is loading, so the sentence count is stale.
  switching?: boolean;
  drawerOpen: boolean;
}>();
const emit = defineEmits<{
  (event: 'resume-following'): void;
  (event: 'toggle-drawer'): void;
}>();

const drawerTooltipRef = ref<InstanceType<typeof QTooltip> | null>(null);

function toggleDrawer() {
  drawerTooltipRef.value?.hide();
  emit('toggle-drawer');
}
</script>

<style>
.lesson-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  height: 36px;
  padding: 0 12px;
  -webkit-app-region: no-drag;
}

.lesson-progress {
  display: flex;
  flex: 1;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: var(--text-body);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.lesson-progress .ellipsis {
  flex: 0 1 auto;
  max-width: min(50vw, 520px);
  min-width: 0;
}

.lesson-count {
  white-space: nowrap;
  color: var(--ink-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 400;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.follow-btn {
  flex-shrink: 0;
  white-space: nowrap;
}

.lesson-heading > .top-sidebar-toggle {
  margin-left: auto;
  flex-shrink: 0;
}
</style>
