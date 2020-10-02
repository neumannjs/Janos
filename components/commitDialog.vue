<template>
  <v-dialog
    v-model="dialog"
    width="500px"
    :persistent="true"
    @input="$emit('input', $event)"
  >
    <template v-slot:activator="{ on }">
      <slot name="activator" :on="on" />
    </template>
    <v-card>
      <v-toolbar color="primary" dark flat>
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text>{{ message }}</v-card-text>
      <v-card-text>
        <v-form ref="form">
          <v-text-field
            v-model="commitMessage"
            :rules="[rules.required]"
            label="Name"
            name="name"
            prepend-icon="mdi-source-commit"
            type="text"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn color="secondary" @click.native="cancel">Cancel</v-btn>
        <v-spacer />
        <v-btn color="primary" @click.native="agree">Commit</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CommitDialog',
  data() {
    return {
      dialog: false,
      resolve: null,
      reject: null,
      message: null,
      title: null,
      commitMessage: '',
      rules: {
        required: value => !!value || 'Required.'
      }
    }
  },
  methods: {
    // https://gist.github.com/eolant/ba0f8a5c9135d1a146e1db575276177d
    open(title, message, commitMessage = '') {
      this.dialog = true
      this.title = title
      this.message = message
      this.commitMessage = commitMessage
      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    agree() {
      if (this.$refs.form.validate()) {
        this.resolve(this.commitMessage)
        this.dialog = false
      }
    },
    cancel() {
      this.resolve(null)
      this.dialog = false
    }
  }
}
</script>

<style></style>
