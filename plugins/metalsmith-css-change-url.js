const debug = require('debug')('plugins/metalsmith-css-change-url')
const multimatch = require('multimatch')

/*
metalsmith-css-change-url
Changes absolute url's in css files to contain the rootpath
*/
module.exports = function (opts) {
  'use strict'

  if (!opts) {
    opts = {}
  }
  opts.pattern = opts.pattern || ['**/*.css']

  return function (files, metalsmith, done) {
    if (metalsmith._metadata.rootPath !== '/') {
      for (const file in files) {
        if (multimatch(file, opts.pattern).length) {
          debug('working on: %s', file)
          const fileContents = new TextDecoder('utf-8').decode(
            files[file].contents
          )
          files[file].contents = new TextEncoder().encode(
            fileContents.replace(/url\(\//g, 'url(' + opts.rootpath)
          )
        }
      }
    }
    done()
  }
}
