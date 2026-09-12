<template>
  <div class="fullscreen glass-error-page text-center q-pa-md flex flex-center">
    <div class="glass-error-panel">
      <div class="glass-error-code">
        404
      </div>

      <div class="text-h4 glass-error-copy">
        页面走丢了
      </div>

      <q-btn
        class="q-mt-xl"
        color="primary"
        unelevated
        to="/"
        label="返回学习页"
        no-caps
      />
    </div>
  </div>
</template>

<script setup>
defineOptions({
  name: 'ErrorNotFound'
});
</script>
