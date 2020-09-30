const debug = require('debug')('plugins/fs')
const { isBinary } = require('istextorbinary')

let store

if (process.browser) {
  window.onNuxtReady(({ $store }) => {
    store = $store
  })
}

module.exports = {
  chmod: function chmod(path, mode, callback) {
    if (!callback) {
      return new Promise(function (resolve, reject) {
        chmod(path, mode || {}, function (err) {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
    // For now just ignore chmod and always call the callback with a null value (no error)
    callback(null)
  },
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
      return new Promise(function (resolve, reject) {
        readFile(path, options || {}, function (err, data) {
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

    debug('readFile path: %s , encoding: %s', path, encoding)

    store.dispatch('github/getFile', path).then(
      file => {
        if (encoding === '' || encoding === undefined) {
          if (file.encoding === 'utf-8') {
            callback(null, Buffer.from(file.content))
          } else {
            callback(null, Buffer.from(file.content, 'base64'))
          }
        } else {
          // for now we'll assume that returning the plain string will do regardless of the exact encoding
          callback(null, file.content)
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
      return new Promise(function (resolve, reject) {
        stat(path, options || {}, function (err, data) {
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
      return new Promise(function (resolve, reject) {
        outputFile(path, contents, encoding, function (err, data) {
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

    const contentsIsBinary = isBinary(path, contents)
    if (!contentsIsBinary) {
      contents = new TextDecoder('utf-8').decode(contents)
    } else {
      contents = contents.toString('base64')
    }

    debug('outputFile fonts or html path: %s , encoding: %s', path, encoding)

    store
      .dispatch('github/updateFileContent', {
        path,
        content: contents
      })
      .then(
        result => {
          debug('github/updateFileContent result: %j', result)
          callback(null, result)
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
