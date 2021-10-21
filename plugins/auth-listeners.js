import Cookies from 'js-cookie'
const debug = require('debug')('plugins/auth-listener')

export default function ({ $axios }) {
  $axios.onError(error => {
    debug('Error object: ' + error)
    debug('error.response: ' + error.response)
    const sites = JSON.parse(error.response.data.info)
    debug('error.response.data.info: ' + sites)
    if (error.response.status === 401) {
      if (sites.length === 1) {
        // TODO: (optional) If things get more complicated, we should move this data exchange through url paramaters to Vuex
        if (sites[0].create) {
          let subfolder = window.location.pathname.split('/')[1]
          const reservedReponames = ['login', 'admin']
          if (reservedReponames.includes(subfolder)) {
            subfolder = ''
          }
          subfolder += subfolder.length > 0 ? '/' : ''
          window.location =
            '/' + subfolder + 'create?reponame=' + sites[0].create
        } else {
          // Before redirect remove cookie used to change access-token endpoint calls
          Cookies.remove('accessTokenEndpoint')
          // Hopefully 30 seconds is enough for the Github pages site to build
          // for the 1st time.
          setTimeout(() => {
            window.location = sites[0].url
          }, 30000)
        }
      } else {
        window.location =
          '/select?repos=' + encodeURIComponent(JSON.stringify(sites))
      }
    }
  })

  $axios.interceptors.request.use(function (config) {
    if (config.url.includes('handler') && Cookies.get('accessTokenEndpoint')) {
      config.url = Cookies.get('accessTokenEndpoint')
    }
    return config
  })
}
