const debug = require('debug')('plugins/metalsmith-webmentions')
const jsonpAdapter = require('axios-jsonp')
const unionBy = require('lodash/unionBy')

// Define Cache Location and API Endpoint
const CACHE_DIR = 'cache'
const API = 'https://webmention.io/api'

/*
This plugin adds webmentions to as a property of a file object in Janos. Should
be placed after permalinks (if that is used) because the plugin needs to know
the url of the page to retreive the webmentions. Writes the files to cache. For
now this plugin assumes it is running in Janos, so it uses the github, flaky
fs that comes with that. Todo: Make the metalsmith fs be injectable.
*/

async function fetchWebmentions(url, lastWmId, perPage = 10000) {
  const axios = window.$nuxt.$axios

  let req = `${API}/mentions.jf2?target=${url}&per-page=${perPage}`
  if (lastWmId) req += `&since_id=${lastWmId}`

  const response = await axios({
    url: req,
    adapter: jsonpAdapter,
    callbackParamName: 'jsonp'
  })
  if (response.status === 200) {
    const feed = response.data
    debug('>>> %d new webmentions fetched from %s', feed.children.length, API)
    return feed
  }

  return null
}

// Merge fresh webmentions with cached entries, unique per id
function mergeWebmentions(a, b) {
  return unionBy(a.children, b.children, 'wm-id')
}

// save combined webmentions in cache file
function writeToCache(path, data) {
  const store = window.$nuxt.$store

  const filePath = `${CACHE_DIR}/${path}/webmentions.json`
  const fileContent = JSON.stringify(data, null, 2)

  // write data to cache json file
  store
    .dispatch('github/updateFileContent', {
      content: fileContent,
      path: filePath
    })
    .then(
      result => {
        debug('Succesfully wrote cache file %s.', filePath)
      },
      err => {
        throw err
      }
    )
}

// get cache contents from json file
async function readFromCache(path) {
  const store = window.$nuxt.$store
  const filePath = `${CACHE_DIR}/${path}/webmentions.json`

  const file = await store.dispatch('github/getFile', filePath)

  if (file) {
    const cacheFile = file.content
    return JSON.parse(cacheFile)
  }

  return {
    lastWmId: null,
    children: []
  }
}

function getSumFactory(property) {
  return function getSum(total, child) {
    if (child['wm-property'] === property) {
      return total + 1
    }
    return total
  }
}

module.exports = function (opts) {
  'use strict'

  return async function (files, metalsmith, done) {
    for (const file in files) {
      // Only request webmentions for files with a layout and a collection. The
      // layout property separates the content pages from other files like image
      // files. The collection property filters out all the generated files for
      // pagination and tags.
      if (files[file].layout && files[file].collection) {
        const protocol = window.location.protocol
        const pagesDomain = window.location.hostname
        const pathName = window.location.pathname
        const cache = await readFromCache(files[file].path)
        debug('cache file found %o', cache)
        debug('pathName %s', pathName)
        const repoName = pathName.substring(1, pathName.indexOf('/admin'))
        debug('repoName %s', repoName)
        let baseUrl =
          repoName === '/'
            ? protocol + pagesDomain + '/'
            : protocol + pagesDomain + '/' + repoName + '/'

        if (process.env.APP_ENV === 'development') {
          debug(
            'Development mode: Setting baseUrl to: %s',
            process.env.APP_DEV_HOMEPAGE
          )
          baseUrl = process.env.APP_DEV_HOMEPAGE
        }
        const req = baseUrl + files[file].path + '/'

        let lastWmId = cache.lastWmId ? cache.lastWmId : null
        lastWmId = lastWmId === 'null' ? null : lastWmId

        // Allow for one day overlap with cache. Webmentions.io doesn't parse
        // everything in real time and we don't want to miss any mentions.
        const feed = await fetchWebmentions(req, lastWmId)
        if (feed) {
          if (feed.children.length > 0) {
            lastWmId = feed.children[0]['wm-id']
          }
          debug('requesting webmentions for url %s', req)
          const children = mergeWebmentions(cache, feed)
          const webmentions = {
            lastWmId,
            children,
            'reply-count': children.reduce(getSumFactory('in-reply-to'), 0),
            'like-count': children.reduce(getSumFactory('like-of'), 0),
            'repost-count': children.reduce(getSumFactory('repost-of'), 0)
          }
          writeToCache(files[file].path, webmentions)
          files[file].webmentions = webmentions
        }

        files[file].webmentions = cache
      }
    }
    done()
  }
}
