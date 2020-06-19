<template>
  <v-dialog v-model="value" :persistent="persistent" width="500px" @input="$emit('input', $event)">
    <template v-slot:activator="{ on }">
      <slot name="activator" :on="on" />
    </template>
    <v-card>
      <v-toolbar color="primary" dark flat>
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text>Select files</v-card-text>
      <v-card-text>
        <v-form ref="form">
          <v-file-input
            v-model="files"
            multiple
            :loading="loading"
            chips
            show-size
            counter
            label="File input"
          ></v-file-input>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="upload()">Upload</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapMutations, mapActions } from 'vuex'
const { isBinary } = require('istextorbinary')

export default {
  name: 'UploadDialog',
  props: {
    title: { type: String, default: 'Upload files' },
    persistent: { type: Boolean, default: true },
    value: { type: Boolean, default: false },
    parent: { type: Object, default: null }
  },
  data() {
    return {
      files: null,
      loading: false
    }
  },
  methods: {
    upload: async function() {
      this.loading = true
      this.fileContents = []
      const that = this
      const uploads = this.files.map(async file => {
        const reader = new FileReader()
        reader.addEventListener('loadend', () => {
          let binary = isBinary(
            file.name,
            Buffer.from(
              reader.result.substr(reader.result.indexOf(';base64,') + 8),
              'base64'
            )
          )
          let newFile = {
            parent: that.parent,
            name: file.name,
            type: 'blob',
            binary,
            mode: '100644'
          }
          if (!binary) {
            newFile.encoding = 'utf-8'
          }
          this.addNodeToTree(newFile).then(node => {
            this.addFile({
              ...newFile,
              path: node.path,
              content: binary
                ? reader.result.substr(reader.result.indexOf(';base64,') + 8)
                : atob(
                    reader.result.substr(reader.result.indexOf(';base64,') + 8)
                  )
            })
          })
        })
        reader.readAsDataURL(file)
      })
      await Promise.all(uploads)
      this.loading = false
      this.$emit('input', false)
    },
    ...mapMutations('github', ['addFile']),
    ...mapActions('github', ['addNodeToTree'])
  }
}
</script>

<style>
</style>

// addNodeToTree({ parent: item, name: '', type: 'blob' }
// Daarna commit addFile met zelfde object maar met conent erbij.
// parent weet je al
// name nu ook
// content
