<template>
  <v-card class="elevation-12">
    <v-toolbar color="primary" dark flat>
      <v-toolbar-title>Create your own website</v-toolbar-title>
    </v-toolbar>
    <v-card-text
      v-show="this.$route.query.reponame"
    >The repository {{ this.$route.query.reponame }} for your personal page is still available. Alternatively you can provide a different name for your website.</v-card-text>
    <v-card-text>
      <v-form ref="form">
        <v-text-field
          v-model="reponame"
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
      <v-btn color="primary" @click="createRepo()">Create</v-btn>
    </v-card-actions>
  </v-card>
</template>

<script>
import Cookies from 'js-cookie'

export default {
  data() {
    return {
      reponame: this.$route.query.reponame,
      rules: {
        required: value => !!value || 'Required.'
      }
    }
  },
  layout: 'centered',
  auth: false,
  methods: {
    createRepo: function() {
      if (this.$refs.form.validate()) {
        Cookies.set(
          'accessTokenEndpoint',
          'http://localhost:7071/api/handler/?reponame=' + this.reponame,
          { expires: 1 }
        )
        this.$router.push('login')
      }
    }
  }
}
</script>
