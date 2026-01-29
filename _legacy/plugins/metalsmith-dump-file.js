const debug = require('debug')('plugins/dump-file')
const { stringify } = require('flatted')

module.exports = function (opts) {
  'use strict'

  return function (files, metalsmith, done) {
    for (const [filename, object] of Object.entries(files)) {
      debug('Looking for %s, checking %s', opts.filename, filename)
      if (opts.filename === filename) {
        const metadata = metalsmith.metadata()
        const dump = { ...metadata, ...object }

        debug(
          'Dumping file %s\n\n%s',
          filename,
          stringify(dump, (key, value) => {
            if (value && typeof value === 'object' && value.type === 'Buffer') {
              return Buffer.from(value.data).toString()
            } else {
              return value
            }
          })
        )
      }
    }
    done()
  }
}
