<template>
  <v-row>
    <footer-buttons placement="left" :status-items="leftStatusItems" />
    <footer-buttons placement="right" :status-items="rightStatusItems" />
    <v-snackbar v-model="snackbar" bottom right :timeout="timeout" auto-height>
      <v-row>
        <v-col cols="12">
          <v-list two-line dense :style="{background: 'transparent'}">
            <template v-for="(item, index) in notifications">
              <v-list-item :key="index" :style="{background: 'transparent'}">
                <v-list-item-content>
                  <v-list-item-title>{{ item.title }}</v-list-item-title>
                  <v-list-item-sub-title>
                    <!-- eslint-disable-next-line -->
                    <span v-html="item.subTitle" />
                  </v-list-item-sub-title>
                </v-list-item-content>
                <v-list-item-action>
                  <v-icon small color="red" @click="removeNotificationAsync(index)">close</v-icon>
                </v-list-item-action>
              </v-list-item>
              <v-divider :key="index"></v-divider>
            </template>
            <v-list-item :style="{background: 'transparent'}">
              <v-list-item-content>
                <v-list-item-title>{{ notifications.length === 0 ? 'No new notifications' : 'Clear all notifications' }}</v-list-item-title>
              </v-list-item-content>
              <v-list-item-action :style="{flexDirection: 'row', alignItems: 'center'}">
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
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-col>
      </v-row>
    </v-snackbar>
  </v-row>
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
