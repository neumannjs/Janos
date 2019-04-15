const debug = require('debug')('metalsmith-myplugin')
const multimatch = require('multimatch')

/*
metalsmith-css-change-url
Changes absolute url's in css files to contain the rootpath
*/
module.exports = function(opts) {
  'use strict'

  opts.pattern = opts.pattern || ['**/*.css']
  opts.rootpath = opts.rootpath || ['/']

  return function(files, metalsmith, done) {
    if (opts.rootpath !== '/') {
      for (const file in files) {
        if (multimatch(file, opts.pattern).length) {
          debug('metalsmith-css-change-url working on: %s', file)
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
