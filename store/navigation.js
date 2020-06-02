export const state = () => ({
  drawers: [],
  activeDrawer: ''
})

export const mutations = {
  addDrawer(state, value) {
    state.drawers.push(value)
  },
  setActiveDrawer(state, value) {
    state.activeDrawer = value
  }
}
