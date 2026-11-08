<template>
  <q-dialog
    :model-value="Boolean(error)"
    persistent
    aria-labelledby="app-error-title"
    aria-describedby="app-error-message"
  >
    <q-card class="glass-dialog" style="width: 420px; max-width: 90vw">
      <q-card-section id="app-error-title" class="text-h6 text-negative">
        <q-icon name="warning" class="q-mr-sm" />{{ error?.title }}
      </q-card-section>
      <q-card-section id="app-error-message" class="q-pt-none">{{ error?.message }}</q-card-section>
      <q-card-actions align="right">
        <q-btn
          v-if="error?.source === 'lesson'"
          flat
          label="重新选择文件夹"
          @click="emit('reopen-folder')"
        />
        <q-btn flat color="primary" label="关闭" autofocus @click="emit('close')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
defineProps<{
  error: { source: 'lesson' | 'recording'; title: string; message: string } | null;
}>();
const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'reopen-folder'): void;
}>();
</script>
