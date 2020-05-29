<template>
  <v-card class="elevation-12">
    <v-toolbar color="primary" dark flat>
      <v-toolbar-title>Select your website</v-toolbar-title>
    </v-toolbar>
    <v-card-text>
      <v-list two-line>
        <template v-for="(repo) in repos">
          <v-list-item :key="repo.name" @click="gotoRepo(repo.url)">
            <v-list-item-content>
              <v-list-item-title v-text="repo.name"></v-list-item-title>
              <v-list-item-sub-title v-text="repo.url"></v-list-item-sub-title>
            </v-list-item-content>
          </v-list-item>
        </template>
      </v-list>
    </v-card-text>
  </v-card>
</template>
<script>
export default {
  data() {
    return {
      repos: JSON.parse(decodeURIComponent(this.$route.query.repos))
    }
  },
  layout: 'centered',
  auth: false,
  methods: {
    gotoRepo: function(uri) {
      window.location = uri
    }
  }
}
</script>
