<template>
  <q-dialog v-model="open">
    <q-card class="glass-dialog" style="width: 360px; max-width: 90vw">
      <q-card-section class="text-h6 q-pb-none">键盘快捷键</q-card-section>
      <q-card-section>
        <dl class="shortcut-list">
          <template v-for="item in shortcutItems" :key="item.label">
            <dt>
              <kbd v-for="key in item.keys" :key="key">{{ key }}</kbd>
            </dt>
            <dd>{{ item.label }}</dd>
          </template>
        </dl>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat color="primary" label="关闭" v-close-popup />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
const open = defineModel<boolean>({ required: true });

const shortcutItems = [
  { keys: ['空格'], label: '播放 / 暂停' },
  { keys: ['S'], label: '跟读开关' },
  { keys: ['A', 'D'], label: '上一句 / 下一句' },
  { keys: ['Q', 'E'], label: '上一课 / 下一课' },
  { keys: ['C', 'X'], label: '加速 / 减速' },
  { keys: ['Z'], label: '重置速度' },
  { keys: ['R'], label: '跳过播放并录音 / 重新录制' },
  { keys: ['Esc'], label: '退出专注显示' },
];
</script>

<style>
.shortcut-list {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px 16px;
  margin: 0;
  color: var(--ink);
  font-size: var(--text-body);
}

.shortcut-list dt {
  display: flex;
  gap: 4px;
}

.shortcut-list dd {
  margin: 0;
}

.shortcut-list kbd {
  min-width: 24px;
  padding: 1px 6px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  color: var(--ink-strong);
  background: var(--bg-sunken);
  font-family: inherit;
  font-size: var(--text-caption);
  font-weight: 500;
  text-align: center;
}
</style>
