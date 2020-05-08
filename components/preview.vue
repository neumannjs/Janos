<template>
  <vue-friendly-iframe :src="url" class-name="previewIFrame"></vue-friendly-iframe>
</template>
<script>
export default {
  name: 'Preview',
  props: {
    url: { type: String, default: null }
  }
}
</script>

<style>
.previewIFrame {
  height: inherit;
  width: inherit;
}
</style>
