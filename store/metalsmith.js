const debug = require('debug')('store/metalsmith')
const Metalsmith = require('metalsmith')
const layouts = require('metalsmith-layouts')
const dateFilter = require('nunjucks-date-filter')
const assets = require('metalsmith-assets')
const rssfeed = require('metalsmith-feed')
const htmlmin = require('metalsmith-html-minifier')
const cssChangeUrl = require('../plugins/metalsmith-css-change-url')
const sourceUrl = require('../plugins/metalsmith-sourceurl')
const writeBuiltUrl = require('../plugins/metalsmith-write-builturl')
const inlineSource = require('../plugins/metalsmith-inline-source')
const pkg = require('../package.json')

var load = (function() {
  // Function which returns a function: https://davidwalsh.name/javascript-functions
  function _load(tag) {
    return function(url) {
      // This promise will be used by Promise.all to determine success or failure
      return new Promise(function(resolve, reject) {
        debug('Started loading %s', url)
        var element = document.createElement(tag)
        var parent = 'body'
        var attr = 'src'

        // Important success and error for the promise
        element.onload = function() {
          debug('Loaded %s', url)
          resolve(url)
        }
        element.onerror = function() {
          debug('Error while loading %s', url)
          reject(url)
        }

        // Need to set different attributes depending on tag type
        switch (tag) {
          case 'script':
            element.async = true
            break
          case 'link':
            element.type = 'text/css'
            element.rel = 'stylesheet'
            attr = 'href'
            parent = 'head'
        }

        // Inject into document to kick off loading
        element[attr] = url
        document[parent].appendChild(element)
      })
    }
  }

  return {
    css: _load('link'),
    js: _load('script'),
    img: _load('img')
  }
})()

export const state = () => ({
  devBuild: true
})

export const mutations = {
  switchDevBuild(state) {
    state.devBuild = !state.devBuild
  }
}

export const actions = {
  async runMetalsmith({ rootState, state, dispatch }) {
    const pagesDomain = rootState.auth.user.login + '.github.io'
    let prodRootPath = null
    if (pagesDomain !== rootState.github.repo) {
      prodRootPath = '/' + rootState.github.repo + '/'
    }

    let metalsmithConfig = await dispatch(
      'github/getFile',
      'src/metalsmith.json',
      {
        root: true
      }
    )

    metalsmithConfig = JSON.parse(atob(metalsmithConfig.content))
    let localPlugins = [
      'sourceUrl',
      'writeBuiltUrl',
      'cssChangeUrl',
      'inlineSource',
      'metalsmith-feed',
      'metalsmith-html-minifier',
      'metalsmith-layouts',
      'metalsmith-assets'
    ]

    //Get all plugin names from metalsmith.json file out of the repo
    //Filter all the local plugins
    //TODO: Force the localPlugins in the build, regardless of metalsmith.json
    let cdnPlugins = metalsmithConfig.plugins
      .map(plugin => Object.keys(plugin)[0])
      .filter(name => !localPlugins.some(localName => localName === name))

    cdnPlugins = cdnPlugins.map((plugin, index) => {
      return metalsmithConfig.plugins[index].pkgVer
        ? 'https://wzrd.in/standalone/' +
            plugin +
            '@' +
            metalsmithConfig.plugins[index].pkgVer
        : 'https://wzrd.in/standalone/' + plugin + '@latest'
    })

    debug('Metalsmith plugins to be loaded %o', cdnPlugins)

    let loadPlugins = cdnPlugins.map(load.js)

    debug('Lazy load markdown plugins')
    await Promise.all(loadPlugins)
    debug('Plugin loaded')

    const siteMeta = {
      version: pkg.version,
      name: 'Neumann SSG',
      description: 'A demonstration static site built using Neumann SSG',
      author: 'Gijs van Dam',
      contact: 'https://twitter.com/gijswijs',
      domain:
        process.env.APP_ENV === 'development'
          ? process.env.APP_DEV_URL + ':' + process.env.APP_DEV_PORT
          : pagesDomain, // set domain
      rootpath: process.env.APP_ENV === 'development' ? '/' : prodRootPath // set absolute path (null for relative)
    }
    const ms = Metalsmith('./')
      .metadata(siteMeta)
      .source('src')
      .destination('docs')
      .clean(!state.devBuild)
      .use(sourceUrl())
      .use(
        window.metalsmithPublish({
          draft: state.devBuild,
          private: state.devBuild
        })
      )
      .use(
        window.metalsmithCollections({
          posts: {
            pattern: 'posts/**/*.md',
            sortBy: 'date',
            reverse: true
          }
        })
      )
      .use(window.metalsmithMarkdown())
      .use(
        window.metalsmithMore({
          key: 'excerpt'
        })
      )
      .use(window.metalsmithPermalinks())
      .use(
        window.metalsmithTags({
          handle: 'tags',
          path: 'topics/:tag/index.html',
          pathPage: 'topics/:tag/:num/index.html',
          perPage: 6,
          layout: '/tag.njk',
          sortBy: 'date',
          reverse: true,
          skipMetadata: false,
          slug: {
            mode: 'rfc3986'
          }
        })
      )
      .use(
        layouts({
          pattern: '**',
          engineOptions: {
            filters: {
              date: dateFilter
            },
            loaders: {
              async: true,
              getSource: async function(name, callback) {
                const fileName = 'layouts/' + name
                try {
                  const file = await dispatch('github/getFile', fileName, {
                    root: true
                  })
                  callback(null, {
                    src: atob(file.content),
                    path: name
                  })
                } catch (e) {
                  callback(e)
                }
              }
            }
          }
        })
      )
      .use(
        rssfeed({
          collection: 'posts',
          site_url: siteMeta.domain + (siteMeta.rootpath || ''),
          title: siteMeta.name,
          description: siteMeta.description
        })
      )
      .use(
        window.metalsmithMapsite({
          hostname: siteMeta.domain + (siteMeta.rootpath || ''),
          omitIndex: true
        })
      )
      .use(
        assets({
          source: 'layouts/assets',
          destination: '/docs'
        })
      )
      .use(writeBuiltUrl())
      .use(
        cssChangeUrl({
          rootpath: siteMeta.rootpath
        })
      )
      .use(inlineSource())

    if (!state.devBuild) {
      ms.use(htmlmin())
    }

    // TODO: The build functions does not call the callback, or doesn't return the files parameter. Bug in Metalsmith?
    ms.build(function(err, files) {
      if (err) {
        debug('runMetalsmith build error: %o', err)
        throw err
      }
      debug('runMetalsmith: build files object: %o', files)
    })
  }
}
