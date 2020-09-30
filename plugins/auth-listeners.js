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
          window.location = '/create?reponame=' + sites[0].create
        } else {
          window.location = sites[0].url
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
