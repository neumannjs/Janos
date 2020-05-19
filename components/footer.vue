<template>
  <v-layout row wrap>
    <footer-buttons placement="left" :status-items="leftStatusItems" />
    <footer-buttons placement="right" :status-items="rightStatusItems" />
    <v-snackbar v-model="snackbar" bottom right :timeout="timeout" auto-height>
      <v-layout row>
        <v-flex xs12>
          <v-list two-line dense :style="{background: 'transparent'}">
            <template v-for="(item, index) in notifications">
              <v-list-tile :key="index" :style="{background: 'transparent'}">
                <v-list-tile-content>
                  <v-list-tile-title>{{ item.title }}</v-list-tile-title>
                  <v-list-tile-sub-title>
                    <span v-html="item.subTitle" />
                  </v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-icon small color="red" @click="removeNotificationAsync(index)">close</v-icon>
                </v-list-tile-action>
              </v-list-tile>
              <v-divider :key="index"></v-divider>
            </template>
            <v-list-tile :style="{background: 'transparent'}">
              <v-list-tile-content>
                <v-list-tile-title>{{ notifications.length === 0 ? 'No new notifications' : 'Clear all notifications' }}</v-list-tile-title>
              </v-list-tile-content>
              <v-list-tile-action :style="{flexDirection: 'row', alignItems: 'center'}">
                <v-icon
                  small
                  :disabled="notifications.length === 0"
                  @click="clearAllNotificationsAsync()"
                >clear_all</v-icon>
                <v-icon
                  v-show="notifications.length === 0"
                  small
                  color="red"
                  @click="snackbar = false"
                >close</v-icon>
              </v-list-tile-action>
            </v-list-tile>
          </v-list>
        </v-flex>
      </v-layout>
    </v-snackbar>
  </v-layout>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'
import FooterButtons from '../components/footerButtons'

export default {
  name: 'Footer',
  components: {
    footerButtons: FooterButtons
  },
  data() {
    return {
      timeout: 6000
    }
  },
  computed: {
    ...mapState('status', ['statusItems', 'notifications']),
    ...mapGetters('status', ['leftStatusItems', 'rightStatusItems']),
    snackbar: {
      set(snackbar) {
        this.$store.commit('status/setSnackbar', snackbar)
      },
      get() {
        return this.$store.state.status.snackbar
      }
    }
  },
  methods: {
    ...mapActions('status', [
      'clearAllNotificationsAsync',
      'removeNotificationAsync'
    ])
  }
}
</script>

<style>
.v-snack__content {
  padding: 0px;
}
</style>
