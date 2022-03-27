const debug = require('debug')('plugins/metalsmith-write-builturl')

/*
This plugin works in conjunction with metalsmith-sourceurl. It looks for files
that have a srcUrl (the original markdown files) and then it writes the current
url of that file to the properties of the original file.
*/

module.exports = function (opts) {
  'use strict'

  return function (files, metalsmith, done) {
    const store = window.$nuxt.$store
    for (const file in files) {
      if (files[file].srcUrl) {
        debug('File %s found with srcUrl %s.', file, files[file].srcUrl)
        store
          .dispatch(
            'github/getFile',
            metalsmith._source + '/' + files[file].srcUrl
          )
          .then(
            f => {
              store
                .dispatch('github/updateFileContent', {
                  content: f.content,
                  path: f.path,
                  builtFile:
                    metalsmith._destination[0] === '/'
                      ? metalsmith._destination.substr(1) + file
                      : metalsmith._destination + file
                })
                .then(
                  result => {
                    debug('Succesfully updated file %o.', result)
                  },
                  err => {
                    throw err
                  }
                )
            },
            err => {
              throw err
            }
          )
      }
    }
    done()
  }
}
