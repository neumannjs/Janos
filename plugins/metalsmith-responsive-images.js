const debug = require('debug')('plugins/metalsmith-responsive-images')
const multimatch = require('multimatch')

/*
metalsmith-responsive-images
Changes markdown image elements into responsive picture elements
*/
module.exports = function (opts) {
  'use strict'

  opts.pattern = opts.pattern || ['**/*.md']

  return function (files, metalsmith, done) {
    for (const file in files) {
      if (multimatch(file, opts.pattern).length) {
        debug('working on: %s', file)
        const fileContents = new TextDecoder('utf-8').decode(
          files[file].contents
        )
        files[file].contents = new TextEncoder().encode(
          fileContents.replace(
            /!\[(?<alt>.+?)\]\((?<url>[^ ]+?)(?: "(?<title>.+?)")?\)/g,
            function (match, p1, p2, p3, offset, string) {
              const imgHtml =
                '<img src="' +
                p2 +
                '" alt="' +
                p1 +
                '" title="' +
                p3 +
                'okok" />'
              return imgHtml
            }
          )
        )
      }
    }
    done()
  }
}
