<template>
  <v-dialog v-model="dialog" width="300px" transition="slide-x-reverse-transition">
    <template v-slot:activator="{ on }">
      <v-btn icon v-on="on">
        <v-avatar size="26">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </v-btn>
    </template>
    <v-layout column class="grey darken-3">
      <div class="text-xs-center">
        <v-avatar size="80" class="my-2">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </div>
      <div class="text-xs-center">{{ user.login }}</div>
      <div class="text-xs-center">
        <v-btn round color="secondary" small @click="logout()">Sign out</v-btn>
      </div>
      <v-flex>
        <v-list dense>
          <v-list-tile
            v-for="site in neumannssgSites"
            :key="site.name"
            @click="redirect(site.name)"
          >
            <v-list-tile-action>
              <v-icon>launch</v-icon>
            </v-list-tile-action>

            <v-list-tile-content>
              <v-list-tile-title v-text="site.name"></v-list-tile-title>
            </v-list-tile-content>
          </v-list-tile>
        </v-list>
      </v-flex>
    </v-layout>
  </v-dialog>
</template>

<script>
import { mapState } from 'vuex'

export default {
  name: 'Account',
  props: {
    model: { type: Boolean, default: false }
  },
  data() {
    return {
      dialog: false
    }
  },
  computed: {
    ...mapState('auth', ['user']),
    ...mapState('github', ['neumannssgSites'])
  },
  methods: {
    logout: async function() {
      await this.$auth.logout()
    },
    redirect: function(site) {
      window.location.href =
        'https://' + this.user.login + '.github.io/' + site + '/admin'
    }
  }
}
</script>

<style>
.v-dialog:not(.v-dialog--fullscreen) {
  top: 32px !important;
  right: 0 !important;
  position: absolute !important;
}
</style>
