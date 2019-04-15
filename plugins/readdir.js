const minimatch = require('minimatch')

function patternMatcher(pattern) {
  return function(path, stats) {
    const minimatcher = new minimatch.Minimatch(pattern, { matchBase: true })
    return (!minimatcher.negate || stats.isFile()) && minimatcher.match(path)
  }
}

function toMatcherFunction(ignoreEntry) {
  if (typeof ignoreEntry === 'function') {
    return ignoreEntry
  } else {
    return patternMatcher(ignoreEntry)
  }
}

let store

if (process.browser) {
  window.onNuxtReady(({ $store }) => {
    store = $store
  })
}

module.exports = async function readdir(path, ignores, callback) {
  if (typeof path === 'function') {
    // eslint-disable-next-line no-func-assign
    readdir = path
  }
  if (typeof ignores === 'function') {
    callback = ignores
    ignores = []
  }

  if (!callback) {
    return new Promise(function(resolve, reject) {
      readdir(path, ignores || [], function(err, data) {
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
  const list = []
  const fileTree = await store.dispatch('github/getFileTree')
  ignores = ignores.map(toMatcherFunction)
  filterFileTree(fileTree, list, ignores, path)
  return callback(null, list)
}

function filterFileTree(fileTree, list, ignores, path) {
  for (let i = 0; i < fileTree.length; i++) {
    if (
      fileTree[i].type === 'blob' &&
      fileTree[i].path.substr(0, path.length) === path
    ) {
      if (
        !ignores.some(function(matcher) {
          // eslint-disable-next-line no-undef
          return matcher(fileTree[i].path, stats)
        })
      ) {
        list.push('/' + fileTree[i].path)
      }
    }
    if (fileTree[i].children) {
      filterFileTree(fileTree[i].children, list, ignores, path)
    }
  }
}
