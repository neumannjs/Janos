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
local.metalsmithResponsiveImages = require('../plugins/metalsmith-responsive-images')
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
    return function (script, parent, attributes, customEvent) {
      // Set default parent based on tag, if parameter not present
      if (!parent) {
        switch (tag) {
          case 'script':
            parent = 'body'
            break
          case 'link':
            parent = 'head'
        }
      }

      // Set default attributes based on tag, if parameter not present
      if (!attributes) {
        switch (tag) {
          case 'script':
            attributes.async = true
            break
          case 'link':
            attributes.type = 'text/css'
            attributes.rel = 'stylesheet'
            attributes.attr = 'href'
        }
      }

      // This promise will be used by Promise.all to determine success or failure
      return new Promise(function (resolve, reject) {
        let isUrl = false
        // Test whether content is passed as an url or as the actual source
        if (/^(ftp|http|https):\/\/[^ "]+$/.test(script)) {
          isUrl = true
        }

        debug('Started loading %s', script)
        if (isUrl) {
          if (
            document.querySelector(
              tag + '[' + attributes.attr + '="' + script + '"]'
            ) != null
          ) {
            debug('Script %s was already found in DOM', script)
            resolve(script)
            return
          }
        } else {
          const currentTags = document.getElementsByTagName(tag)
          for (let i = 0; i < currentTags.length; i++) {
            if (currentTags[i].innerHTML === script) {
              debug('Script %s was already found in DOM', script)
              resolve(script)
              return
            }
          }
        }
        const element = document.createElement(tag)

        // Important success and error for the promise
        if (customEvent) {
          window.addEventListener(customEvent, event => {
            debug('Custom event fired for script %s', script)
            resolve(script)
          })
        } else {
          element.onload = () => {
            debug('Loaded %s', script)
            resolve(script)
          }
        }

        element.onerror = () => {
          debug('Error while loading %s', script)
          reject(script)
        }

        // Set attributes with the corrcet values. If the key is `attr` then the
        // value belonging to that key is the *name* of the attribute that
        // should hold the `url`.

        for (const [attribute, value] of Object.entries(attributes)) {
          if (attribute !== 'attr') {
            element[attribute] = value
          } else if (isUrl) {
            element[value] = script
          }
        }

        // If the source is given (instead of an url) load the source as innerHTML
        if (!isUrl) {
          element.innerHTML = script
        }

        // Inject into document to kick off loading
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
  async runMetalsmith({ commit, state, dispatch, rootState, rootGetters }) {
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
    const metalsmithConfig = rootGetters['github/metalsmithConfigObject']

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
          ? process.env.APP_MODULES_CDN +
            Object.keys(plugin)[0] +
            '@' +
            plugin.pkgVer
          : process.env.APP_MODULES_CDN + Object.keys(plugin)[0]
        metalsmithConfig.plugins[index].local = false
      }
    })

    debug('Metalsmith plugins to be loaded %o', metalsmithConfig.plugins)

    let loadScript = ''

    metalsmithConfig.plugins.forEach(plugin => {
      if (!plugin.local) {
        loadScript +=
          'import ' +
          camelCase(Object.keys(plugin)[0]) +
          " from '" +
          plugin.url +
          "';window['" +
          camelCase(Object.keys(plugin)[0]) +
          "']=" +
          camelCase(Object.keys(plugin)[0]) +
          ';'
      }
    })
    loadScript += "window.dispatchEvent(new CustomEvent('jspm'));"

    debug('Lazy load markdown plugins')
    await load.js(loadScript, 'body', { async: true, type: 'module' }, 'jspm')
    debug('Plugins loaded')

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
