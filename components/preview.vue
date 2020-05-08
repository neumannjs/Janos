<template>
  <iframe :srcDoc="srcDoc" class="previewIFrame" />
</template>
<script>
import { mapActions } from 'vuex'

export default {
  name: 'Preview',
  props: {
    path: { type: String, default: null }
  },
  data() {
    return {
      srcDoc: ''
    }
  },
  created() {
    console.log('Get FILE!')
    this.getFile(this.path).then(file => (this.srcDoc = atob(file.content)))
  },
  methods: {
    ...mapActions('github', ['getFile'])
  }
}
</script>

<style>
.previewIFrame {
  border: none;
  height: inherit;
  width: inherit;
}
</style>
