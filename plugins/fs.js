const { isBinary } = require('istextorbinary')

let store

if (process.browser) {
  window.onNuxtReady(({ $store }) => {
    store = $store
  })
}

module.exports = {
  readFile: function readFile(path, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = ''
    }
    let encoding = ''
    if (typeof options === 'string') {
      encoding = options
    } else if (typeof options === 'object') {
      encoding = options.encoding
      // ignore file system flags for now
    }
    if (!callback) {
      return new Promise(function(resolve, reject) {
        readFile(path, options || {}, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
    }
    if (path.substr(0, 1) === '/') {
      path = path.substr(1)
    }
    if (path.indexOf('fonts/') > -1 || path.indexOf('.md') > -1) {
      console.log('readfile')
      console.log(path)
      console.log(encoding)
    }
    store.dispatch('github/getFile', path).then(
      file => {
        if (encoding === '' || encoding === undefined) {
          callback(null, Buffer.from(file.content, 'base64'))
        } else {
          // for now we'll assume that returning the plain string will do regardless of the exact encoding
          callback(null, atob(file.content))
        }
      },
      err => {
        callback(err)
      }
    )
  },
  stat: function stat(path, options, callback) {
    if (typeof options === 'function') {
      callback = options
      options = {}
    }
    if (!callback) {
      return new Promise(function(resolve, reject) {
        stat(path, options || {}, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
    }
    const stats = {
      mode: 100644
    }
    callback(null, stats)
  },
  outputFile: function outputFile(path, contents, encoding, callback) {
    // https://github.com/jprichardson/node-fs-extra/blob/5b29ae3aa5198c33820a07eaa4493a5b6d01fa82/lib/output/index.js
    if (typeof encoding === 'function') {
      callback = encoding
      encoding = 'utf8'
    }

    if (!callback) {
      return new Promise(function(resolve, reject) {
        outputFile(path, contents, function(err, data) {
          if (err) {
            reject(err)
          } else {
            resolve(data)
          }
        })
      })
    }

    if (path.substr(0, 1) === '/') {
      path = path.substr(1)
    }

    const contentsIsBinary = isBinary(null, contents)
    if (!contentsIsBinary) {
      contents = btoaUTF8(new TextDecoder('utf-8').decode(contents))
    } else {
      contents = contents.toString('base64')
    }

    if (path.indexOf('fonts/') > -1 || path.indexOf('.html') > -1) {
      console.log('outputFile')
      console.log(path)
      console.log(encoding)
    }

    store
      .dispatch('github/updateFileContent', {
        path,
        content: contents
      })
      .then(
        result => {
          console.log(result)
        },
        err => {
          callback(err)
        }
      )
  }
}

// TODO: Make a PR for Metalsmith that uses dependency injection for everything filesystem related.
// Possible approach: create a wrapper that constructs a metalsmith instance with the default fs-modules.
// Export this wrapper as the default function, but also export the core function
// Import the core function in neumannssg
// Construct a metalsmith instance with the github-fs modules

// TODO: switch to a flat(ter) filesystem model, without nesting. Both git(hub) and metalsmith use this, so this would make searches easier (no recursion)
// TODO: use BrowserFS? https://github.com/jvilk/BrowserFS (or https://github.com/isomorphic-git/lightning-fs) in combination with isomorphic-git https://isomorphic-git.org/docs/en/browser.html

const btoaUTF8 = (function(btoa, replacer) {
  'use strict'
  return function(inputString, BOMit) {
    return btoa(
      (BOMit ? '\xEF\xBB\xBF' : '') +
        inputString.replace(
          /[\x80-\uD7ff\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]?/g,
          replacer
        )
    )
  }
})(
  btoa,
  (function(fromCharCode) {
    return function(nonAsciiChars) {
      'use strict'
      // make the UTF string into a binary UTF-8 encoded string
      let point = nonAsciiChars.charCodeAt(0)
      if (point >= 0xd800 && point <= 0xdbff) {
        const nextcode = nonAsciiChars.charCodeAt(1)
        // eslint-disable-next-line no-self-compare
        if (nextcode !== nextcode)
          // NaN because string is 1 code point long
          return fromCharCode(
            0xef /* 11101111 */,
            0xbf /* 10111111 */,
            0xbd /* 10111101 */
          )
        // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
        if (nextcode >= 0xdc00 && nextcode <= 0xdfff) {
          point = (point - 0xd800) * 0x400 + nextcode - 0xdc00 + 0x10000
          if (point > 0xffff)
            return fromCharCode(
              (0x1e /* 0b11110 */ << 3) | (point >>> 18),
              (0x2 /* 0b10 */ << 6) | ((point >>> 12) & 0x3f) /* 0b00111111 */,
              (0x2 /* 0b10 */ << 6) | ((point >>> 6) & 0x3f) /* 0b00111111 */,
              (0x2 /* 0b10 */ << 6) | (point & 0x3f) /* 0b00111111 */
            )
        } else return fromCharCode(0xef, 0xbf, 0xbd)
      }
      if (point <= 0x007f) return nonAsciiChars
      else if (point <= 0x07ff) {
        return fromCharCode(
          (0x6 << 5) | (point >>> 6),
          (0x2 << 6) | (point & 0x3f)
        )
      } else
        return fromCharCode(
          (0xe /* 0b1110 */ << 4) | (point >>> 12),
          (0x2 /* 0b10 */ << 6) | ((point >>> 6) & 0x3f) /* 0b00111111 */,
          (0x2 /* 0b10 */ << 6) | (point & 0x3f) /* 0b00111111 */
        )
    }
  })(String.fromCharCode)
)
