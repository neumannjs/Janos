<template>
  <v-card height="100%" width="100%" flat tile>
    <v-hover v-show="!snackbar">
      <v-btn
        slot-scope="{ hover }"
        absolute
        dark
        fab
        bottom
        right
        small
        class="btnOffset"
        :style="hover ? {opacity: '1'} : {opacity: '0.3'}"
        @click="fullscreen = true"
      >
        <v-icon>fullscreen</v-icon>
      </v-btn>
    </v-hover>
    <iframe :srcDoc="srcDoc" class="previewIFrame" />
    <v-dialog v-model="fullscreen" fullscreen hide-overlay transition="dialog-right-transition">
      <v-card height="100%" width="100%" flat tile>
        <v-hover>
          <v-btn
            slot-scope="{ hover }"
            absolute
            dark
            fab
            bottom
            right
            small
            class="btnOffset"
            :style="hover ? {opacity: '1'} : {opacity: '0.3'  }"
            @click="fullscreen = false"
          >
            <v-icon>fullscreen_exit</v-icon>
          </v-btn>
        </v-hover>
        <iframe :srcDoc="srcDoc" class="previewIFrame" />
      </v-card>
    </v-dialog>
  </v-card>
</template>
<script>
import { mapActions, mapState } from 'vuex'
const debug = require('debug')('components/preview')

export default {
  name: 'Preview',
  props: {
    path: { type: String, default: null }
  },
  data() {
    return {
      fullscreen: false,
      srcDoc: ''
    }
  },
  computed: {
    ...mapState('status', ['snackbar']),
    ...mapState('github', ['fileContents'])
  },
  watch: {
    'file.content': {
      handler: function(val) {
        debug('file watcher detected change')
        if (val) {
          this.srcDoc = atob(val)
        } else {
          this.srcDoc = ''
        }
      }
    },
    path: {
      handler: function(val) {
        debug('path watcher detected change')
        if (val) {
          this.srcDoc = atob(val)
        } else {
          this.srcDoc = ''
        }
      }
    }
  },
  asyncComputed: {
    file: {
      async get() {
        debug('file async computed')
        let file = await this.getFile(this.path)
        return file
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

.btnOffset {
  margin: 0px 24px 20px 0px;
  bottom: 0px !important;
}
</style>
