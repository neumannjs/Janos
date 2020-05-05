import VuexPersistence from 'vuex-persist'

export default ({ store }) => {
  new VuexPersistence({
    storage: window.localStorage,
    reducer: state => ({
      redirect_uri: {
        redirectUri: state.redirect_uri.redirectUri
      }
    })
  }).plugin(store)
}
