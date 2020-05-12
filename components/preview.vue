<template>
  <iframe :srcDoc="srcDoc" class="previewIFrame" />
</template>
<script>
import { mapActions } from 'vuex'
const debug = require('debug')('layouts/default')

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
  watch: {
    path: function(val) {
      debug(
        'path updated, calling mapped action getFile from store/github, with path: ' +
          this.path
      )
      if (this.path.length > 0) {
        this.getFile(this.path).then(file => (this.srcDoc = atob(file.content)))
      }
    }
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
