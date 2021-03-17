<template>
  <v-dialog
    v-model="value"
    :persistent="persistent"
    width="500px"
    @input="$emit('input', $event)"
  >
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
import { mapActions } from 'vuex'
import { uploadFile } from './../utils/upload_file'

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
    async upload() {
      this.loading = true
      this.fileContents = []
      const that = this
      const callback = newFile => {
        this.updateFileContent({ content: newFile.content, path: newFile.path })
      }
      const uploads = this.files.map(file => {
        uploadFile(file, that.parent, callback)
      })
      await Promise.all(uploads)
      this.loading = false
      this.$emit('input', false)
      this.files = null
    },
    ...mapActions('github', ['updateFileContent'])
  }
}
</script>

<style></style>
