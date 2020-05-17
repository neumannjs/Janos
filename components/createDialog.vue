<template>
  <v-dialog v-model="value" :persistent="persistent" width="500px" @input="$emit('input', $event)">
    <template v-slot:activator="{ on }">
      <slot name="activator" :on="on" />
    </template>
    <v-card>
      <v-toolbar color="primary" dark flat>
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text
        v-show="personalRepo"
      >The repository {{ personalRepo }} for your personal page is still available. Alternatively you can provide a different name for your website.</v-card-text>
      <v-card-text>
        <v-form ref="form">
          <v-text-field
            v-model="repoName"
            :rules="[rules.required]"
            label="Name"
            name="name"
            prepend-icon="create"
            type="text"
          ></v-text-field>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="create(repoName)">Create</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  name: 'CreateDialog',
  props: {
    title: { type: String, default: 'Create your own website' },
    repoName: { type: String, default: '' },
    persistent: { type: Boolean, default: true },
    value: { type: Boolean, default: false }
  },
  data() {
    return {
      dialog: false,
      rules: {
        required: value => !!value || 'Required.'
      },
      personalRepo: ''
    }
  },
  mounted: function() {
    this.personalRepo = this.repoName
  },
  methods: {
    create: function(value) {
      this.$emit('create', value)
    }
  }
}
</script>

<style>
</style>
