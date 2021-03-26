const debug = require('debug')('plugins/metalsmith-responsive-images')
const multimatch = require('multimatch')
const { sniffKeyType, getSizes } = require('../../frontend-image-encode/lib2')

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

  return async function (files, metalsmith, done) {
    const store = window.$nuxt.$store
    for (const file in files) {
      if (multimatch(file, opts.pattern).length) {
        debug('working on: %s', file)
        let fileContents = new TextDecoder('utf-8').decode(files[file].contents)
        fileContents = await replaceAsync(
          fileContents,
          /!\[(?<alt>.+?)\]\((?<url>[^ ]+?)(?: "(?<title>.+?)")?\)/g,
          async function (match, p1, p2, p3, offset, string) {
            const githubBlob = await store.dispatch(
              'github/getFile',
              metalsmith._source + p2
            )
            const file = new File(
              [Buffer.from(githubBlob.content, 'base64')],
              p2
            )
            try {
              const keyType = await sniffKeyType(file)
              debug('Image file found %o with keytype %s', file, keyType)
            } catch (err) {
              debug('Image file appears not to be resizeable. %s', file)
              return match
            }
            const imageSet = await getSizes(file, opts)
            let imageSetHtml = '<picture>'
            for (let i = 0; i < opts.format.length; i++) {
              let srcSet = ''
              let sizes = ''
              // Run through the image array from smallest to largest, so backwards
              for (let j = imageSet[opts.format[i]].length - 1; j >= 0; j--) {
                const image = imageSet[opts.format[i]][j]
                // add source to the srcSet
                srcSet += image.name + ' ' + image.width + 'w,'
                // add sizesAttr and replace ${width} with the actual width of the image
                sizes +=
                  opts['sizes-attr'][j].replace('%width', image.width) + ','
              }
              srcSet = srcSet.substr(0, srcSet.length - 1)
              sizes = sizes.substr(0, sizes.length - 1)
              if (opts.format[i] === 'jpg') {
                const smallestImage = imageSet.jpg[imageSet.jpg.length - 1]
                imageSetHtml +=
                  '<img srcSet="' +
                  srcSet +
                  '" sizes="' +
                  sizes +
                  '" src="' +
                  smallestImage.name +
                  '" alt="' +
                  p1 +
                  '" title="' +
                  p3 +
                  '" loading="lazy" decoding="async" width="' +
                  smallestImage.width +
                  '" height="' +
                  smallestImage.height +
                  '"/>'
              } else {
                imageSetHtml +=
                  '<source srcSet="' +
                  srcSet +
                  '" sizes="' +
                  sizes +
                  '" type="image/' +
                  [opts.format[i]] +
                  '"/>'
              }
            }
            imageSetHtml += '</picture>'
            debug('imageSet HTML: %s', imageSetHtml)
            return imageSetHtml
          }
        )

        files[file].contents = fileContents
      }
    }
    done()
  }
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = []
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args)
    promises.push(promise)
  })
  const data = await Promise.all(promises)
  return str.replace(regex, () => data.shift())
}
