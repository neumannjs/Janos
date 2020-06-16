<template>
  <v-dialog v-model="dialog" width="300px" transition="slide-x-reverse-transition">
    <template v-slot:activator="{ on }">
      <v-btn icon v-on="on">
        <v-avatar size="26">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </v-btn>
    </template>
    <v-card flat>
      <v-card-title class="justify-center px-0">
        <container>
          <v-row no-gutters>
            <v-col cols="12" class="text-center">
              <v-avatar size="80" class="my-2">
                <img :src="user.avatar_url" :alt="user.login" />
              </v-avatar>
            </v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="12" class="text-center">{{ repo }}</v-col>
          </v-row>
          <v-row no-gutters>
            <v-col cols="12" class="text-center">
              <v-btn rounded color="secondary" small @click="logout()">Sign out</v-btn>
            </v-col>
          </v-row>
        </container>
      </v-card-title>
      <v-card-text class="pa-0">
        <v-divider />
        <v-list dense nav class="transparent">
          <v-list-item
            v-for="site in neumannssgSites"
            v-show="!site.active && site.neumannssg"
            :key="site.name"
            @click="redirect(site.url)"
          >
            <v-list-item-action>
              <v-icon>launch</v-icon>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title class="subheading" v-text="site.name"></v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <CreateDialog
            v-model="createDialog"
            :personal-repo="repoName"
            :persistent="false"
            title="Create new website"
            @create="createRepo($event)"
          />
          <v-list-item @click="createDialog = true; dialog = false">
            <v-list-item-action>
              <v-icon>add_box</v-icon>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title class="subheading">Create new website</v-list-item-title>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
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

<style lang="scss" scoped>
@import '~vuetify/src/styles/styles.sass';

::v-deep .v-dialog {
  top: 32px !important;
  right: 0 !important;
  position: absolute !important;
}

.v-card.theme--dark {
  background-color: map-get($material-dark-elevation-colors, '16');
}
</style>
