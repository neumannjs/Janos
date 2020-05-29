<template>
  <v-dialog v-model="dialog" width="300px" transition="slide-x-reverse-transition">
    <template v-slot:activator="{ on }">
      <v-btn icon v-on="on">
        <v-avatar size="26">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </v-btn>
    </template>
    <v-row class="grey darken-3">
      <div class="text-center">
        <v-avatar size="80" class="my-2">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </div>
      <div class="text-center">{{ repo }}</div>
      <div class="text-center my-2">
        <v-btn round color="secondary" small @click="logout()">Sign out</v-btn>
      </div>
      <v-divider />
      <v-col>
        <v-list dense>
          <v-list-tile
            v-for="site in neumannssgSites"
            v-show="!site.active && site.neumannssg"
            :key="site.name"
            @click="redirect(site.url)"
          >
            <v-list-tile-action>
              <v-icon>launch</v-icon>
            </v-list-tile-action>

            <v-list-tile-content>
              <v-list-tile-title class="subheading" v-text="site.name"></v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
          <CreateDialog
            v-model="createDialog"
            :personal-repo="repoName"
            :persistent="false"
            title="Create new website"
            lazy
            @create="createRepo($event)"
          />
          <v-list-tile @click="createDialog = true; dialog = false">
            <v-list-tile-action>
              <v-icon>add_box</v-icon>
            </v-list-tile-action>

            <v-list-tile-content>
              <v-list-tile-title class="subheading">Create new website</v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-col>
    </v-row>
  </v-dialog>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import CreateDialog from './createDialog'
const debug = require('debug')('components/accountDialog')

export default {
  name: 'AccountDialog',
  components: {
    CreateDialog
  },
  props: {
    model: { type: Boolean, default: false }
  },
  data() {
    return {
      dialog: false,
      repoName: '',
      createDialog: false
    }
  },
  computed: {
    ...mapState('auth', ['user']),
    ...mapState('github', ['neumannssgSites', 'repo'])
  },
  updated: function() {
    debug(
      'Find %s.github.io in neumannssgSite: %o',
      this.user.login,
      this.neumannssgSites
    )
    this.repoName = this.neumannssgSites.some(
      site => site.name == this.user.login + '.github.io'
    )
      ? ''
      : this.user.login + '.github.io'
  },
  methods: {
    logout: async function() {
      await this.$auth.logout()
    },
    redirect: function(url) {
      window.location.href = url
    },
    ...mapActions('github', ['createRepo'])
  }
}
</script>

<style scoped>
>>> .v-dialog {
  top: 32px !important;
  right: 0 !important;
  position: absolute !important;
}
</style>
