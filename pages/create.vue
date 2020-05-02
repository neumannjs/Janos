<template>
  <v-card class="elevation-12">
    <v-toolbar color="primary" dark flat>
      <v-toolbar-title>Create your own website</v-toolbar-title>
    </v-toolbar>
    <v-card-text>
      <v-form>
        <v-text-field
          v-model="reponame"
          label="Name"
          name="name"
          prepend-icon="create"
          type="text"
        />
      </v-form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn color="primary" @click="say()">Create</v-btn>
    </v-card-actions>
  </v-card>
</template>
<script>
export default {
  data() {
    return {
      reponame: this.$route.query.reponame
    }
  },
  layout: 'centered',
  auth: false,
  methods: {
    say: function() {
      alert('hello')
    }
  }
}
</script>
