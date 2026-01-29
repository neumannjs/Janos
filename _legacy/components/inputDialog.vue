<template>
  <v-dialog
    v-model="dialog"
    :persistent="persistent"
    width="500px"
    @click:outside="onClickOutside"
    @input="$emit('input', $event)"
  >
    <template v-slot:activator="{ on }">
      <slot name="activator" :on="on" />
    </template>
    <v-card>
      <v-toolbar color="primary" dark flat>
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text v-show="message"> {{ message }}</v-card-text>
      <v-form ref="form" @submit="submit">
        <v-card-text>
          <v-text-field
            v-model="input"
            :rules="[rules.required]"
            :label="label"
            :name="label"
            :prepend-icon="icon"
            type="text"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn v-show="cancel" color="secondary" @click.native="abort">{{
            cancel
          }}</v-btn>
          <v-spacer />
          <v-btn color="primary" type="submit">{{ agree }}</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
  <!-- The repository for your personal page is still available. Alternatively you can provide a different name for your website. -->
</template>

<script>
export default {
  name: 'InputDialog',
  model: {
    prop: 'dialog',
    event: 'input'
  },
  props: {
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    agree: { type: String, default: 'Submit' },
    cancel: { type: String, default: 'Cancel' },
    label: { type: String, default: 'Input' },
    input: { type: String, default: '' },
    icon: { type: String, default: 'create' },
    persistent: { type: Boolean, default: true },
    dialog: { type: Boolean, default: false }
  },
  data() {
    return {
      rules: {
        required: value => !!value || 'Required.'
      },
      resolve: null,
      reject: null
    }
  },
  methods: {
    submit(e) {
      e.preventDefault()
      if (this.$refs.form.validate()) {
        this.closeDialog()
        if (this.resolve === null) {
          this.$emit('submit', this.input)
        } else {
          this.resolve(this.input)
        }
      }
    },
    // https://gist.github.com/eolant/ba0f8a5c9135d1a146e1db575276177d
    open(title, message, agree, cancel, label, icon, persistent, input = '') {
      this.dialog = true
      this.title = title
      this.message = message
      this.agree = agree
      this.cancel = cancel
      this.label = label
      this.persistent = persistent
      this.input = input
      this.icon = icon
      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    abort() {
      this.closeDialog()
      if (this.reject !== null) {
        this.reject('input cancelled')
      }
    },
    closeDialog() {
      this.dialog = false
      this.$emit('update:dialog', this.dialog)
    },
    onClickOutside() {
      if (!this.persistent) {
        this.dialog = false
        this.$emit('update:dialog', this.dialog)
      }
    }
  }
}
</script>

<style></style>
