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
        :style="hover ? { opacity: '1' } : { opacity: '0.3' }"
        @click="fullscreen = true"
      >
        <v-icon>fullscreen</v-icon>
      </v-btn>
    </v-hover>
    <iframe :srcDoc="file.content" class="previewIFrame" />
    <v-dialog
      v-model="fullscreen"
      fullscreen
      hide-overlay
      transition="dialog-right-transition"
    >
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
            :style="hover ? { opacity: '1' } : { opacity: '0.3' }"
            @click="fullscreen = false"
          >
            <v-icon>fullscreen_exit</v-icon>
          </v-btn>
        </v-hover>
        <iframe :srcDoc="file.content" class="previewIFrame" />
      </v-card>
    </v-dialog>
  </v-card>
</template>
<script>
import { mapActions, mapState } from 'vuex'

export default {
  name: 'Preview',
  props: {
    file: { type: Object, default: null }
  },
  data() {
    return {
      fullscreen: false
    }
  },
  computed: {
    ...mapState('status', ['snackbar']),
    ...mapState('github', ['fileContents'])
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
