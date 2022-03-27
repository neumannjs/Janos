const debug = require('debug')('plugins/metalsmith-sourceurl')

/*
This plugin creates an extra property holding the url/filename of the file. This
is useful when you want to keep track of the original url or filename in a
Metalsmith process where those will change because of templating and permalinks.
*/

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
