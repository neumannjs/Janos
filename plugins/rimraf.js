const debug = require('debug')('plugins/rimraf')

let store

if (process.browser) {
  window.onNuxtReady(({ $store }) => {
    store = $store
  })
}

module.exports = function rimraf(path, options, callback) {
  debug('rimraf called for path %s', path)
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  if (path.substr(0, 1) === '/') {
    path = path.substr(1)
  }
  if (path.substr(path.length - 2, 2) === '/*') {
    path = path.substr(0, path.length - 2)
  }
  store.dispatch('github/clearFolder', path).then(() => {
    callback()
  })
}
