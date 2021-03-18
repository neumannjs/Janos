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
      <v-card-text v-show="text"> {{ text }}</v-card-text>
      <v-form ref="form" @submit="submit">
        <v-card-text>
          <v-text-field
            v-model="input"
            :rules="[rules.required]"
            :label="label"
            :name="label"
            prepend-icon="create"
            type="text"
          ></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" type="submit">{{ button }}</v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
  <!-- The repository for your personal page is still available. Alternatively you can provide a different name for your website. -->
</template>

<script>
export default {
  name: 'CreateDialog',
  props: {
    title: { type: String, default: '' },
    text: { type: String, default: '' },
    button: { type: String, default: 'Submit' },
    label: { type: String, default: '' },
    input: { type: String, default: '' },
    personalRepo: { type: String, default: '' },
    persistent: { type: Boolean, default: true },
    value: { type: Boolean, default: false }
  },
  data() {
    return {
      rules: {
        required: value => !!value || 'Required.'
      }
    }
  },
  methods: {
    submit(e) {
      e.preventDefault()
      if (this.$refs.form.validate()) {
        this.value = false
        this.$emit('submit', this.input)
      }
    }
  }
}
</script>

<style></style>
