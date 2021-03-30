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
                srcSet +=
                  (metalsmith._metadata.rootpath + image.name).replace(
                    /\/\//g,
                    '/'
                  ) +
                  ' ' +
                  image.width +
                  'w,'
              }
              for (let j = opts['sizes-attr'].length - 1; j >= 0; j--) {
                if (
                  opts['sizes-attr'].length === imageSet[opts.format[i]].length
                ) {
                  // add sizesAttr and replace ${width} with the actual width of the image
                  const image = imageSet[opts.format[i]][j]
                  sizes +=
                    opts['sizes-attr'][j].replace('%width', image.width) + ','
                } else {
                  // cardinality sizes-attr array isn't equal to imageSet, so only add sizesAttr
                  sizes += opts['sizes-attr'][j]
                }
              }
              srcSet = srcSet.substr(0, srcSet.length - 1)
              sizes = sizes.substr(0, sizes.length - 1)
              if (opts.format[i] === 'jpg') {
                const smallestImage = imageSet.jpg[imageSet.jpg.length - 1]
                imageSetHtml += '<img srcSet="' + srcSet
                imageSetHtml += sizes === '' ? '' : '" sizes="' + sizes
                imageSetHtml +=
                  '" src="' +
                  (metalsmith._metadata.rootpath + smallestImage.name).replace(
                    /\/\//g,
                    '/'
                  ) +
                  '" alt="' +
                  p1 +
                  '" title="' +
                  p3 +
                  '" loading="lazy" decoding="async"'

                imageSetHtml +=
                  sizes !== ''
                    ? ''
                    : ' width="' +
                      smallestImage.width +
                      '" height="' +
                      smallestImage.height +
                      '"'
                imageSetHtml += '/>'
              } else {
                imageSetHtml += '<source srcSet="' + srcSet
                imageSetHtml += sizes === '' ? '' : '" sizes="' + sizes
                imageSetHtml += '" type="image/' + [opts.format[i]] + '"/>'
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
