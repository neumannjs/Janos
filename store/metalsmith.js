const debug = require('debug')('store/metalsmith')
const Metalsmith = require('metalsmith')
const find = require('lodash/find')
const merge = require('lodash/merge')
const kebabCase = require('lodash/kebabCase')
const camelCase = require('lodash/camelCase')
const local = {}
local.metalsmithLayouts = require('metalsmith-layouts')
local.metalsmithTags = require('metalsmith-tags')
local.metalsmithAssets = require('metalsmith-assets')
local.metalsmithFeed = require('metalsmith-feed')
local.metalsmithHtmlMinifier = require('metalsmith-html-minifier')
local.metalsmithPermalinks = require('@metalsmith/permalinks')
local.cssChangeUrl = require('../plugins/metalsmith-css-change-url')
local.sourceUrl = require('../plugins/metalsmith-sourceurl')
local.writeBuiltUrl = require('../plugins/metalsmith-write-builturl')
local.inlineSource = require('../plugins/metalsmith-inline-source')
local.dumpFile = require('../plugins/metalsmith-dump-file')
/* eslint-disable no-unused-vars */
const nunjucksDateFilter = require('nunjucks-date-filter')
const handlebarsDateHelper = require('handlebars-dateformat')
/* eslint-enable no-unused-vars */

// const load = (function () {
//   // Function which returns a function: https://davidwalsh.name/javascript-functions
//   function _load(tag) {
//     return function (url) {
//       // This promise will be used by Promise.all to determine success or failure
//       return new Promise(function (resolve, reject) {
//         debug('Started loading %s', url)
//         let parent = 'body'
//         let attr = 'src'
//         if (
//           document.querySelector(tag + '[' + attr + '="' + url + '"]') != null
//         ) {
//           debug('Script %s was already found in DOM', url)
//           resolve(url)
//           return
//         }
//         const element = document.createElement(tag)

//         // Important success and error for the promise
//         element.onload = function () {
//           debug('Loaded %s', url)
//           resolve(url)
//         }
//         element.onerror = function () {
//           debug('Error while loading %s', url)
//           reject(url)
//         }

//         // Need to set different attributes depending on tag type
//         switch (tag) {
//           case 'script':
//             element.async = true
//             break
//           case 'link':
//             element.type = 'text/css'
//             element.rel = 'stylesheet'
//             attr = 'href'
//             parent = 'head'
//         }

//         // Inject into document to kick off loading
//         element[attr] = url
//         document[parent].appendChild(element)
//       })
//     }
//   }

//   return {
//     css: _load('link'),
//     js: _load('script')
//   }
// })()

const getSource = function (prefix, dispatch) {
  return function (name, callback) {
    const fileName = prefix + name
    dispatch('github/getFile', fileName, {
      root: true
    })
      .then(file => {
        callback(null, {
          src: file.content,
          path: name
        })
      })
      .catch(error => {
        debug('file with path %s returned an error.', fileName)
        callback(error)
      })
  }
}

export const state = () => ({
  metalsmithDisabled: false,
  queuedRun: false
})

export const mutations = {
  setMetalsmithDisabled(state, value) {
    state.metalsmithDisabled = value
  },
  setQueuedRun(state, value) {
    state.queuedRun = value
  }
}

export const actions = {
  async runMetalsmith({ commit, state, dispatch, rootState }) {
    if (rootState.github.currentBranch === 'source') {
      return
    }
    if (state.metalsmithDisabled) {
      commit('setQueuedRun', true)
      return
    } else {
      commit('setQueuedRun', false)
    }
    commit('setMetalsmithDisabled', true)
    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'metalsmith',
        button: false,
        text: 'loading plugins...',
        icon: 'mdi-anvil',
        progress: { indeterminate: true }
      },
      { root: true }
    )
    const devBuild = rootState.github.currentBranch === 'development'
    let metalsmithConfig = await dispatch(
      'github/getFile',
      '_layouts/metalsmith.json',
      {
        root: true
      }
    )

    metalsmithConfig = JSON.parse(metalsmithConfig.content)
    const localPlugins = Object.keys(local).map(name => kebabCase(name))
    debug('kebabCased local plugins %o', localPlugins)
    const findPlugin = find(metalsmithConfig.plugins, 'metalsmith-layouts')
    merge(findPlugin, {
      'metalsmith-layouts': {
        pattern: '**',
        engineOptions: {
          filters: {
            date: nunjucksDateFilter
          },
          loaders: {
            async: true,
            getSource: getSource('_layouts/', dispatch)
          }
        }
      }
    })

    if (findPlugin['metalsmith-layouts'].engineOptions.partials) {
      const loadPartials = Object.entries(
        findPlugin['metalsmith-layouts'].engineOptions.partials
      ).map(async partial => {
        debug(
          'Registering partial %s with partial file %s',
          partial[0],
          partial[1]
        )
        const file = await dispatch('github/getFile', partial[1], {
          root: true
        })
        debug('partial with path %s found: %o', partial[1], file)
        findPlugin['metalsmith-layouts'].engineOptions.partials[partial[0]] =
          file.content
      })
      await Promise.all(loadPartials)
    }

    this.handlebarsDateHelper = handlebarsDateHelper
    if (findPlugin['metalsmith-layouts'].engineOptions.helpers) {
      Object.entries(
        findPlugin['metalsmith-layouts'].engineOptions.helpers
      ).forEach(helper => {
        debug(
          'Registering helper %s with variable %o',
          helper[0],
          this[helper[1]]
        )
        findPlugin['metalsmith-layouts'].engineOptions.helpers[
          helper[0]
        ] = this[helper[1]]
      })
    }

    // Get all plugin names from metalsmith.json file out of the repo
    // Filter all the local plugins
    // TODO: Force the localPlugins in the build, regardless of metalsmith.json
    metalsmithConfig.plugins.forEach((plugin, index) => {
      if (
        localPlugins.some(localName => localName === Object.keys(plugin)[0])
      ) {
        metalsmithConfig.plugins[index].local = true
      } else {
        metalsmithConfig.plugins[index].url = plugin.pkgVer
          ? process.env.APP_WZRD_SERVICE +
            'standalone/' +
            Object.keys(plugin)[0] +
            '@' +
            plugin.pkgVer
          : process.env.APP_WZRD_SERVICE +
            'standalone/' +
            Object.keys(plugin)[0] +
            '@latest'
        metalsmithConfig.plugins[index].local = false
      }
    })

    debug('Metalsmith plugins to be loaded %o', metalsmithConfig.plugins)

    // debug('Load everything using jspm')
    // const systemjsImportmap = document.createElement('script')
    // systemjsImportmap.type = 'systemjs-importmap'
    // systemjsImportmap.innerHTML = `
    // {
    //   "imports": {
    //     "metalsmith-collections": "https://ga.system.jspm.io/npm:metalsmith-collections@0.9.0/lib/index.js",
    //     "metalsmith-debug": "https://ga.system.jspm.io/npm:metalsmith-debug@1.2.0/lib/index.js",
    //     "metalsmith-mapsite": "https://ga.system.jspm.io/npm:metalsmith-mapsite@1.0.6/lib/index.js",
    //     "metalsmith-markdown": "https://ga.system.jspm.io/npm:metalsmith-markdown@1.3.0/lib/index.js",
    //     "metalsmith-more": "https://ga.system.jspm.io/npm:metalsmith-more@0.2.0/lib/index.js",
    //     "metalsmith-pagination": "https://ga.system.jspm.io/npm:metalsmith-pagination@1.5.0/metalsmith-pagination.js",
    //     "metalsmith-publish": "https://ga.system.jspm.io/npm:metalsmith-publish@0.1.6/lib/index.js"
    //   },
    //   "scopes": {
    //     "https://ga.system.jspm.io/": {
    //       "array-differ": "https://ga.system.jspm.io/npm:array-differ@1.0.0/index.js",
    //       "array-union": "https://ga.system.jspm.io/npm:array-union@1.0.2/index.js",
    //       "array-uniq": "https://ga.system.jspm.io/npm:array-uniq@1.0.3/index.js",
    //       "arrify": "https://ga.system.jspm.io/npm:arrify@1.0.1/index.js",
    //       "balanced-match": "https://ga.system.jspm.io/npm:balanced-match@1.0.0/index.js",
    //       "brace-expansion": "https://ga.system.jspm.io/npm:brace-expansion@1.1.11/index.js",
    //       "buffer": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/buffer.js",
    //       "component-props": "https://ga.system.jspm.io/npm:component-props@1.1.1/index.js",
    //       "concat-map": "https://ga.system.jspm.io/npm:concat-map@0.0.1/index.js",
    //       "debug": "https://ga.system.jspm.io/npm:debug@2.6.9/src/index.js",
    //       "extend": "https://ga.system.jspm.io/npm:extend@3.0.2/index.js",
    //       "fs": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/fs.js",
    //       "has-flag": "https://ga.system.jspm.io/npm:has-flag@4.0.0/index.js",
    //       "is": "https://ga.system.jspm.io/npm:is@3.3.0/index.js",
    //       "js-yaml": "https://ga.system.jspm.io/npm:js-yaml@1.0.3/index.js",
    //       "jsml": "https://ga.system.jspm.io/npm:jsml@0.0.1/jsml.js",
    //       "lodash.isundefined": "https://ga.system.jspm.io/npm:lodash.isundefined@3.0.1/index.js",
    //       "lodash.pickby": "https://ga.system.jspm.io/npm:lodash.pickby@4.6.0/index.js",
    //       "lodash/chunk": "https://ga.system.jspm.io/npm:lodash@4.17.21/chunk.js",
    //       "lodash/isArray": "https://ga.system.jspm.io/npm:lodash@4.17.21/isArray.js",
    //       "lodash/padStart": "https://ga.system.jspm.io/npm:lodash@4.17.21/padStart.js",
    //       "marked": "https://ga.system.jspm.io/npm:marked@0.7.0/lib/marked.js",
    //       "minimatch": "https://ga.system.jspm.io/npm:minimatch@3.0.4/minimatch.js",
    //       "ms": "https://ga.system.jspm.io/npm:ms@2.0.0/index.js",
    //       "multimatch": "https://ga.system.jspm.io/npm:multimatch@2.1.0/index.js",
    //       "net": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/net.js",
    //       "os": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/os.js",
    //       "path": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/path.js",
    //       "process": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/process.js",
    //       "props": "https://ga.system.jspm.io/npm:props@0.3.0/props.js",
    //       "read-metadata": "https://ga.system.jspm.io/npm:read-metadata@1.0.0/index.js",
    //       "sitemap": "https://ga.system.jspm.io/npm:sitemap@2.2.0/index.js",
    //       "slash": "https://ga.system.jspm.io/npm:slash@2.0.0/index.js",
    //       "supports-color": "https://ga.system.jspm.io/npm:supports-color@8.1.1/index.js",
    //       "to-function": "https://ga.system.jspm.io/npm:to-function@2.0.6/index.js",
    //       "tty": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/tty.js",
    //       "uniq": "https://ga.system.jspm.io/npm:uniq@1.0.1/uniq.js",
    //       "url-join": "https://ga.system.jspm.io/npm:url-join@4.0.1/lib/url-join.js",
    //       "util": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/util.js",
    //       "xmlbuilder": "https://ga.system.jspm.io/npm:xmlbuilder@10.1.1/lib/index.js",
    //       "xtend": "https://ga.system.jspm.io/npm:xtend@4.0.2/immutable.js",
    //       "yaml-js": "https://ga.system.jspm.io/npm:yaml-js@0.0.8/lib/yaml.js",
    //       "zlib": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/zlib.js"
    //     },
    //     "https://ga.system.jspm.io/npm:debug@4.1.1/": {
    //       "ms": "https://ga.system.jspm.io/npm:ms@2.1.3/index.js"
    //     },
    //     "https://ga.system.jspm.io/npm:debug@4.3.2/": {
    //       "ms": "https://ga.system.jspm.io/npm:ms@2.1.2/index.js"
    //     },
    //     "https://ga.system.jspm.io/npm:metalsmith-markdown@1.3.0/": {
    //       "debug": "https://ga.system.jspm.io/npm:debug@4.3.2/src/index.js"
    //     },
    //     "https://ga.system.jspm.io/npm:metalsmith-publish@0.1.6/": {
    //       "debug": "https://ga.system.jspm.io/npm:debug@4.1.1/src/index.js"
    //     }
    //   }
    // }`

    // const jspmTest = document.createElement('script')
    // jspmTest.innerHTML = `
    // System.import("metalsmith-collections").then(m => window.metalsmithCollections = m.default);
    // System.import("metalsmith-debug").then(m => window.metalsmithDebug = m.default);
    // System.import("metalsmith-mapsite").then(m => window.metalsmithMapsite = m.default);
    // System.import("metalsmith-markdown").then(m => window.metalsmithMarkdown = m.default);
    // System.import("metalsmith-more").then(m => window.metalsmithMore = m.default);
    // System.import("metalsmith-pagination").then(m => window.metalsmithPagination = m.default);
    // System.import("metalsmith-publish").then(m => window.metalsmithPublish = m.default);
    // `

    // document.body.appendChild(systemjsImportmap)
    // document.body.appendChild(jspmTest)

    // debug('JSPM scripts should be loaded by now')

    // const cdnPlugins = metalsmithConfig.plugins.map(plugin => {
    //   if (!plugin.local) {
    //     return load.js(plugin.url)
    //   }
    // })

    // debug('Lazy load markdown plugins')
    // await Promise.all(cdnPlugins)
    // debug('Plugins loaded')

    const pagesDomain = rootState.github.repoOwner + '.github.io'

    metalsmithConfig.metadata.domain = pagesDomain
    metalsmithConfig.metadata.rootpath = '/'
    metalsmithConfig.metadata.now = new Date()

    if (!devBuild && pagesDomain !== rootState.github.repo) {
      metalsmithConfig.metadata.rootpath += rootState.github.repo + '/'
    }
    // overrule some metadata
    if (process.env.APP_ENV === 'development') {
      metalsmithConfig.metadata.domain =
        process.env.APP_DEV_URL + ':' + process.env.APP_DEV_PORT
    }

    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'metalsmith',
        button: false,
        text: 'building...',
        icon: 'mdi-anvil',
        progress: { indeterminate: false, value: 50 }
      },
      { root: true }
    )

    let ms = Metalsmith('./')

    if (metalsmithConfig.metadata) {
      ms = ms.metadata(metalsmithConfig.metadata)
    }

    if (metalsmithConfig.source) {
      ms = ms.source(metalsmithConfig.source)
    }

    if (metalsmithConfig.destination) {
      ms = ms.destination(metalsmithConfig.destination)
    }

    if (
      Object.prototype.hasOwnProperty.call(metalsmithConfig, 'clean') &&
      !devBuild
    ) {
      ms = ms.clean(metalsmithConfig.clean)
    } else if (
      Object.prototype.hasOwnProperty.call(metalsmithConfig, 'devClean') &&
      devBuild
    ) {
      ms = ms.clean(metalsmithConfig.devClean)
    }

    metalsmithConfig.plugins.forEach(plugin => {
      const pluginName = Object.keys(plugin)[0]
      const pluginNameCamelCase = camelCase(pluginName)
      debug(pluginNameCamelCase)
      if (
        !Object.prototype.hasOwnProperty.call(plugin, 'dev') ||
        (Object.prototype.hasOwnProperty.call(plugin, 'dev') &&
          plugin.dev === devBuild)
      ) {
        if (plugin.local) {
          if (typeof plugin[pluginName] === 'boolean') {
            ms = ms.use(local[pluginNameCamelCase]())
          } else {
            ms = ms.use(local[pluginNameCamelCase](plugin[pluginName]))
          }
          debug('Metalsmith configured with local plugin %s', pluginName)
        } else {
          if (typeof plugin[pluginName] === 'boolean') {
            ms = ms.use(window[pluginNameCamelCase]())
          } else {
            ms = ms.use(window[pluginNameCamelCase](plugin[pluginName]))
          }
          debug('Metalsmith configured with remote plugin %s', pluginName)
        }
      }
    })

    // TODO: The build functions does not call the callback, or doesn't return the files parameter. Bug in Metalsmith?
    debug('Start build now')

    ms.build(function (err, files) {
      if (err) {
        debug('runMetalsmith build error: %o', err)
      }
      debug('runMetalsmith: build files object: %o', files)
      commit(
        'status/addOrUpdateStatusItem',
        {
          name: 'metalsmith',
          button: false,
          text: 'build done',
          icon: 'mdi-anvil',
          progress: { indeterminate: false, value: 100 }
        },
        { root: true }
      )
      if (state.queuedRun) {
        dispatch('runMetalsmith')
      } else {
        commit('setMetalsmithDisabled', false)
        setTimeout(function () {
          commit(
            'status/addOrUpdateStatusItem',
            {
              name: 'metalsmith',
              text: 'idle',
              icon: 'mdi-anvil',
              button: false
            },
            { root: true }
          )
        }, 6000)
      }
    })
  }
}
