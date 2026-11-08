<template>
  <div v-if="status.visible" class="practice-status" :class="`practice-status--${status.tone}`">
    <ol class="practice-steps" aria-label="练习步骤">
      <li
        v-for="(step, index) in status.steps"
        :key="step"
        :class="{
          'is-active': index === status.activeStep,
          'is-done': index < status.activeStep,
        }"
        :aria-current="index === status.activeStep ? 'step' : undefined"
      >
        {{ step }}
      </li>
    </ol>
    <span v-if="status.message" class="practice-status__message">{{ status.message }}</span>
  </div>
</template>

<script setup lang="ts">
import type { PracticeStatus } from '../utils/practice-status';

defineProps<{ status: PracticeStatus }>();
</script>

<style scoped>
.practice-status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--ink-muted);
  font-family: var(--font-sans);
  font-size: var(--text-caption);
  font-weight: 400;
  letter-spacing: 0;
}

.practice-steps {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.practice-steps li {
  padding: 1px 8px;
  border-radius: var(--radius-full);
  color: var(--ink-faint);
  white-space: nowrap;
  transition: color 120ms ease, background-color 120ms ease;
}

.practice-steps li.is-done {
  color: var(--ink-muted);
}

.practice-steps li.is-active {
  color: var(--active-ink);
  background: var(--active-bg);
  font-weight: 600;
}

.practice-status--recording .practice-steps li.is-active {
  color: var(--recording-ink);
  background: var(--recording-bg);
}

.practice-status__message {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.practice-status--warning .practice-status__message {
  color: var(--warning-ink);
  font-weight: 500;
}

@media (max-width: 600px) {
  .practice-steps li:not(.is-active) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .practice-steps li {
    transition: none;
  }
}
</style>
