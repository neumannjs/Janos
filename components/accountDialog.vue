<template>
  <v-dialog
    v-model="dialog"
    width="300px"
    transition="slide-x-reverse-transition"
  >
    <template v-slot:activator="{ on }">
      <v-btn icon v-on="on">
        <v-avatar size="26">
          <img :src="user.avatar_url" :alt="user.login" />
        </v-avatar>
      </v-btn>
    </template>
    <v-card flat>
      <v-card-title class="justify-center px-0">
        <v-container>
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
              <v-btn rounded color="secondary" small @click="logout()"
                >Sign out</v-btn
              >
            </v-col>
          </v-row>
        </v-container>
      </v-card-title>
      <v-card-text class="pa-0">
        <v-row no-gutters>
          <v-col cols="12" class="text-center">Janos v{{ version }}</v-col>
        </v-row>
      </v-card-text>
      <v-card-text class="pa-0">
        <v-divider />
        <v-list dense nav class="transparent">
          <v-list-item
            v-for="site in janosSites"
            v-show="!site.active && site.janos"
            :key="site.name"
            @click="redirect(site.url)"
          >
            <v-list-item-action>
              <v-icon>launch</v-icon>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title
                class="subheading"
                v-text="site.name"
              ></v-list-item-title>
            </v-list-item-content>
          </v-list-item>
          <InputDialog
            :dialog.sync="createDialog"
            :message="
              repoName
                ? 'The repository ' +
                  repoName +
                  ' for your personal page is still available. Alternatively you can provide a different name for your website.'
                : ''
            "
            :input="repoName"
            :persistent="false"
            title="Create new website"
            label="Name"
            agree="Create"
            @submit="dialogcreateRepo($event)"
          />
          <v-list-item
            @click="
              createDialog = true
              dialog = false
            "
          >
            <v-list-item-action>
              <v-icon>add_box</v-icon>
            </v-list-item-action>

            <v-list-item-content>
              <v-list-item-title class="subheading"
                >Create new website</v-list-item-title
              >
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import InputDialog from './inputDialog'
const debug = require('debug')('components/accountDialog')
const version = require('./../package.json').version

export default {
  name: 'AccountDialog',
  components: {
    InputDialog
  },
  props: {
    model: { type: Boolean, default: false }
  },
  data() {
    return {
      dialog: false,
      repoName: '',
      createDialog: false,
      version
    }
  },
  computed: {
    ...mapState('auth', ['user']),
    ...mapState('github', ['janosSites', 'repo'])
  },
  updated() {
    debug(
      'Find %s.github.io in janosSites: %o',
      this.user.login,
      this.janosSites
    )
    this.repoName = this.janosSites.some(
      site => site.name === this.user.login + '.github.io'
    )
      ? ''
      : this.user.login + '.github.io'
  },
  methods: {
    async logout() {
      await this.$auth.logout()
    },
    redirect(url) {
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
