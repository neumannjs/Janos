const debug = require('debug')('plugins/metalsmith-write-builturl')

module.exports = function(opts) {
  'use strict'

  return function(files, metalsmith, done) {
    let store = window.$nuxt.$store
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
                  builtFile: metalsmith._destination + '/' + file
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
