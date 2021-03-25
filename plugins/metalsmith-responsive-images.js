const debug = require('debug')('plugins/metalsmith-responsive-images')
const multimatch = require('multimatch')
const { sniffKeyType } = require('../../frontend-image-encode/lib2')

/*
metalsmith-responsive-images
Changes markdown image elements into responsive picture elements
*/
module.exports = function (opts) {
  'use strict'
  if (!opts) {
    opts = {}
  }
  opts.pattern = opts.pattern || ['**/*.md']

  return function (files, metalsmith, done) {
    const store = window.$nuxt.$store
    for (const file in files) {
      if (multimatch(file, opts.pattern).length) {
        debug('working on: %s', file)
        let fileContents = new TextDecoder('utf-8').decode(files[file].contents)
        fileContents = fileContents.replace(
          /!\[(?<alt>.+?)\]\((?<url>[^ ]+?)(?: "(?<title>.+?)")?\)/g,
          async function (match, p1, p2, p3, offset, string) {
            //     const imgHtml =
            //       '<img src="' +
            //       p2 +
            //       '" alt="' +
            //       p1 +
            //       '" title="' +
            //       p3 +
            //       'okok" />'
            //     return imgHtml
            //   })
            const githubBlob = await store.dispatch(
              'github/getFile',
              metalsmith._source + p2
            )
            const file = new File(
              [Buffer.from(githubBlob.content, 'base64')],
              githubBlob.name
            )
            const keyType = await sniffKeyType(file)
            debug('Image file found %o with keytype %s', file, keyType)
            return match
          }
        )

        files[file].contents = fileContents
      }
    }
    done()
  }
}
