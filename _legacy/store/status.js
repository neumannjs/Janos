import Vue from 'vue'

export const state = () => ({
  statusItems: [
    {
      name: 'notifications',
      button: true,
      icon: 'notifications',
      right: true,
      dispatch: 'status/toggleSnackbar'
    }
  ],
  notifications: [],
  snackbar: false
})

export const mutations = {
  updateBadge(state, amount) {
    const index = state.statusItems.findIndex(
      item => item.name === 'notifications'
    )
    if (index > -1) {
      const updatedItem = state.statusItems[index]
      Vue.set(updatedItem, 'badge', amount)
      Vue.set(state.statusItems, index, updatedItem)
    }
  },
  removeStatusItem(state, name) {
    state.statusItems.splice(
      state.statusItems.findIndex(item => item.name === name),
      1
    )
  },
  addOrUpdateStatusItem(state, updatedItem) {
    let idleItem = null
    if (Array.isArray(updatedItem)) {
      idleItem = updatedItem[1]
      updatedItem = updatedItem[0]
    }
    let index = state.statusItems.findIndex(
      item => item.name === updatedItem.name
    )
    if (index > -1) {
      Vue.set(state.statusItems, index, updatedItem)
    } else {
      state.statusItems.push(updatedItem)
      index = state.statusItems.length
    }
    if (idleItem) {
      setTimeout(function () {
        Vue.set(state.statusItems, index, idleItem)
      }, 6000)
    }
  },
  addNotification(state, notification) {
    state.notifications.push(notification)
  },
  toggleSnackbar(state) {
    state.snackbar = !state.snackbar
  },
  setSnackbar(state, value) {
    state.snackbar = value
  }
}

export const actions = {
  toggleSnackbar({ commit }) {
    commit('toggleSnackbar')
  },
  addNotification({ commit, state }, notification) {
    commit('setSnackbar', true)
    commit('addNotification', notification)
    commit('updateBadge', state.notifications.length)
  },
  removeNotification({ state, commit }, index) {
    state.notifications.splice(index, 1)
    commit('updateBadge', state.notifications.length)
  },
  clearAllNotifications({ state, commit }) {
    state.notifications = []
    commit('updateBadge', state.notifications.length)
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
