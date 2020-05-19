import Vue from 'vue'

export const state = () => ({
  statusItems: [
    {
      name: 'github',
      button: false,
      text: 'idle',
      icon: 'mdi-github'
    },
    {
      name: 'notifications',
      button: true,
      icon: 'notifications',
      right: true,
      dispatch: 'status/toggleSnackbarAsync'
    }
  ],
  notifications: [],
  snackbar: false
})

export const mutations = {
  removeStatusItem(state, name) {
    state.statusItems.splice(
      state.statusItems.findIndex(item => item.name === name),
      1
    )
  },
  addOrUpdateStatusItem(state, updatedItem) {
    const index = state.statusItems.findIndex(
      item => item.name === updatedItem.name
    )
    if (index > -1) {
      Vue.set(state.statusItems, index, updatedItem)
    } else {
      state.statusItems.push(updatedItem)
    }
  },
  addNotification(state, notification) {
    state.notifications.push(notification)
  },
  removeNotification(state, index) {
    state.notifications.splice(index, 1)
  },
  clearAllNotifications(state) {
    state.notifications = []
  },
  toggleSnackbar(state) {
    state.snackbar = !state.snackbar
  },
  setSnackbar(state, value) {
    state.snackbar = value
  }
}

export const actions = {
  toggleSnackbarAsync({ commit }) {
    commit('toggleSnackbar')
  },
  clearAllNotificationsAsync({ commit }) {
    commit('clearAllNotifications')
  },
  removeNotificationAsync({ commit }, index) {
    commit('removeNotification', index)
  },
  addNotificationAsync({ commit }, notification) {
    commit('setSnackbar', true)
    commit('addNotification', notification)
  },
  removeStatusItemAsync({ commit }, name) {
    commit('removeStatusItem', name)
  },
  addOrUpdateStatusItemAsync({ commit }, statusItem) {
    commit('addOrUpdateStatusItem', statusItem)
  }
}

export const getters = {
  leftStatusItems: state => {
    return state.statusItems.filter(item => !item.right)
  },
  rightStatusItems: state => {
    return state.statusItems.filter(item => item.right)
  }
}
