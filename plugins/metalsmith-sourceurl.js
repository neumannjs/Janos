const debug = require('debug')('plugins/metalsmith-sourceurl')

module.exports = function (opts) {
  'use strict'

  return function (files, metalsmith, done) {
    for (const file in files) {
      debug('adding srcUrl property to file %s', file)
      files[file].srcUrl = file
    }
    done()
  }
}
