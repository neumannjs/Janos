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
local.cssChangeUrl = require('../plugins/metalsmith-css-change-url')
local.sourceUrl = require('../plugins/metalsmith-sourceurl')
local.writeBuiltUrl = require('../plugins/metalsmith-write-builturl')
local.inlineSource = require('../plugins/metalsmith-inline-source')
local.dumpFile = require('../plugins/metalsmith-dump-file')
/* eslint-disable no-unused-vars */
const nunjucksDateFilter = require('nunjucks-date-filter')
const handlebarsDateHelper = require('handlebars-dateformat')
/* eslint-enable no-unused-vars */

const load = (function () {
  // Function which returns a function: https://davidwalsh.name/javascript-functions
  function _load(tag) {
    return function (url) {
      // This promise will be used by Promise.all to determine success or failure
      return new Promise(function (resolve, reject) {
        debug('Started loading %s', url)
        let parent = 'body'
        let attr = 'src'
        if (
          document.querySelector(tag + '[' + attr + '="' + url + '"]') != null
        ) {
          debug('Script %s was already found in DOM', url)
          resolve(url)
          return
        }
        const element = document.createElement(tag)

        // Important success and error for the promise
        element.onload = function () {
          debug('Loaded %s', url)
          resolve(url)
        }
        element.onerror = function () {
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
    js: _load('script')
  }
})()

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
        debug('file with path %s returend an error.', fileName)
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

    const cdnPlugins = metalsmithConfig.plugins.map(plugin => {
      if (!plugin.local) {
        return load.js(plugin.url)
      }
    })

    debug('Lazy load markdown plugins')
    await Promise.all(cdnPlugins)
    debug('Plugin loaded')

    const pagesDomain = rootState.auth.user.login.toLowerCase() + '.github.io'

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
