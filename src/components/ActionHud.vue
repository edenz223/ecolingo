<template>
  <div class="action-hud">
    <Transition name="action-hud">
      <span v-if="message" class="action-hud__pill">{{ message }}</span>
    </Transition>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
</script>

<style scoped>
.action-hud {
  position: fixed;
  left: 50%;
  bottom: 96px;
  z-index: 2100;
  transform: translateX(-50%);
  pointer-events: none;
}

.action-hud__pill {
  display: inline-block;
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-full);
  color: var(--ink-strong);
  background: var(--bg-raised);
  box-shadow: var(--shadow-md);
  font-size: var(--text-control);
  font-weight: 500;
  white-space: nowrap;
}

.action-hud-enter-active,
.action-hud-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.action-hud-enter-from,
.action-hud-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .action-hud-enter-active,
  .action-hud-leave-active {
    transition: none;
  }
}
</style>
