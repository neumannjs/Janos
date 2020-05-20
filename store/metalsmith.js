const debug = require('debug')('store/metalsmith')
const Metalsmith = require('metalsmith')
const permalinks = require('metalsmith-permalinks')
const layouts = require('metalsmith-layouts')
const markdown = require('metalsmith-markdown')
const collections = require('metalsmith-collections')
const dateFilter = require('nunjucks-date-filter')
const more = require('metalsmith-more')
const assets = require('metalsmith-assets')
const rssfeed = require('metalsmith-feed')
const sitemap = require('metalsmith-mapsite')
const publish = require('metalsmith-publish')
const htmlmin = require('metalsmith-html-minifier')
const tags = require('metalsmith-tags')
const cssChangeUrl = require('../plugins/metalsmith-css-change-url')
const sourceUrl = require('../plugins/metalsmith-sourceurl')
const writeBuiltUrl = require('../plugins/metalsmith-write-builturl')
const inlineSource = require('../plugins/metalsmith-inline-source')
const pkg = require('../package.json')

export const state = () => ({
  devBuild: true
})

export const mutations = {
  switchDevBuild(state) {
    state.devBuild = !state.devBuild
  }
}

export const actions = {
  runMetalsmith({ rootState, state, dispatch }) {
    const pagesDomain = rootState.auth.user.login + '.github.io'
    let prodRootPath = null
    if (pagesDomain !== rootState.github.repo) {
      prodRootPath = '/' + rootState.github.repo + '/'
    }

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
    return new Promise((resolve, reject) => {
      const ms = Metalsmith('./')
        .metadata(siteMeta)
        .source('src')
        .destination('docs')
        .clean(!state.devBuild)
        .use(sourceUrl())
        .use(
          publish({
            draft: state.devBuild,
            private: state.devBuild
          })
        )
        .use(
          collections({
            posts: {
              pattern: 'posts/**/*.md',
              sortBy: 'date',
              reverse: true
            }
          })
        )
        .use(markdown())
        .use(
          more({
            key: 'excerpt'
          })
        )
        .use(permalinks())
        .use(
          tags({
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
          sitemap({
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

      resolve()
    })
  }
}
