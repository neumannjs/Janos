import path from 'path'
import webpack from 'webpack'
import VuetifyLoaderPlugin from 'vuetify-loader/lib/plugin'
import pkg from './package'
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin')
require('dotenv').config()

const buildPlugins = [
  new VuetifyLoaderPlugin(),
  new webpack.NormalModuleReplacementPlugin(/recursive-readdir/, function (
    resource
  ) {
    resource.request = path.resolve(__dirname, './plugins/readdir')
  }),
  new webpack.NormalModuleReplacementPlugin(/fs/, function (resource) {
    resource.request = path.resolve(__dirname, './plugins/fs')
  }),
  new webpack.NormalModuleReplacementPlugin(/co-fs-extra/, function (resource) {
    resource.request = path.resolve(__dirname, './plugins/fs')
  }),
  new webpack.NormalModuleReplacementPlugin(/require-one/, function (resource) {
    resource.request = path.resolve(__dirname, './plugins/require-one')
  }),
  new webpack.NormalModuleReplacementPlugin(/rimraf/, function (resource) {
    resource.request = path.resolve(__dirname, './plugins/rimraf')
  }),
  new webpack.NormalModuleReplacementPlugin(/stat-mode/, function (resource) {
    resource.request = path.resolve(__dirname, './plugins/stat-mode')
  }),
  new webpack.NormalModuleReplacementPlugin(/uglify-js/, 'uglifyjs-browser')
]

if (process.env.NODE_ENV == 'production') {
  buildPlugins.push(
    new ReplaceInFileWebpackPlugin([
      {
        dir: '.nuxt/dist/client',
        test: /\.js$/,
        rules: [
          {
            search: '="/nuxt',
            replace: '="../nuxt'
          }
        ]
      }
    ])
  )
}

module.exports = {
  mode: 'spa',

  /*
   ** Headers of the page
   */
  head: {
    title: pkg.name,
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: pkg.description }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      {
        rel: 'stylesheet',
        href:
          'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700|Material+Icons'
      }
    ],
    script: [
      {
        src: 'https://ga.system.jspm.io/npm:systemjs@6.8.3/dist/s.min.js',
        async: true,
        defer: true
      },
      {
        type: 'systemjs-importmap',
        innerHTML: `
    {
      "imports": {
        "metalsmith-collections": "https://ga.system.jspm.io/npm:metalsmith-collections@0.9.0/lib/index.js",
        "metalsmith-debug": "https://ga.system.jspm.io/npm:metalsmith-debug@1.2.0/lib/index.js",
        "metalsmith-mapsite": "https://ga.system.jspm.io/npm:metalsmith-mapsite@1.0.6/lib/index.js",
        "metalsmith-markdown": "https://ga.system.jspm.io/npm:metalsmith-markdown@1.3.0/lib/index.js",
        "metalsmith-more": "https://ga.system.jspm.io/npm:metalsmith-more@0.2.0/lib/index.js",
        "metalsmith-pagination": "https://ga.system.jspm.io/npm:metalsmith-pagination@1.5.0/metalsmith-pagination.js",
        "metalsmith-publish": "https://ga.system.jspm.io/npm:metalsmith-publish@0.1.6/lib/index.js"
      },
      "scopes": {
        "https://ga.system.jspm.io/": {
          "array-differ": "https://ga.system.jspm.io/npm:array-differ@1.0.0/index.js",
          "array-union": "https://ga.system.jspm.io/npm:array-union@1.0.2/index.js",
          "array-uniq": "https://ga.system.jspm.io/npm:array-uniq@1.0.3/index.js",
          "arrify": "https://ga.system.jspm.io/npm:arrify@1.0.1/index.js",
          "balanced-match": "https://ga.system.jspm.io/npm:balanced-match@1.0.0/index.js",
          "brace-expansion": "https://ga.system.jspm.io/npm:brace-expansion@1.1.11/index.js",
          "buffer": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/buffer.js",
          "component-props": "https://ga.system.jspm.io/npm:component-props@1.1.1/index.js",
          "concat-map": "https://ga.system.jspm.io/npm:concat-map@0.0.1/index.js",
          "debug": "https://ga.system.jspm.io/npm:debug@2.6.9/src/index.js",
          "extend": "https://ga.system.jspm.io/npm:extend@3.0.2/index.js",
          "fs": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/fs.js",
          "has-flag": "https://ga.system.jspm.io/npm:has-flag@4.0.0/index.js",
          "is": "https://ga.system.jspm.io/npm:is@3.3.0/index.js",
          "js-yaml": "https://ga.system.jspm.io/npm:js-yaml@1.0.3/index.js",
          "jsml": "https://ga.system.jspm.io/npm:jsml@0.0.1/jsml.js",
          "lodash.isundefined": "https://ga.system.jspm.io/npm:lodash.isundefined@3.0.1/index.js",
          "lodash.pickby": "https://ga.system.jspm.io/npm:lodash.pickby@4.6.0/index.js",
          "lodash/chunk": "https://ga.system.jspm.io/npm:lodash@4.17.21/chunk.js",
          "lodash/isArray": "https://ga.system.jspm.io/npm:lodash@4.17.21/isArray.js",
          "lodash/padStart": "https://ga.system.jspm.io/npm:lodash@4.17.21/padStart.js",
          "marked": "https://ga.system.jspm.io/npm:marked@0.7.0/lib/marked.js",
          "minimatch": "https://ga.system.jspm.io/npm:minimatch@3.0.4/minimatch.js",
          "ms": "https://ga.system.jspm.io/npm:ms@2.0.0/index.js",
          "multimatch": "https://ga.system.jspm.io/npm:multimatch@2.1.0/index.js",
          "net": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/net.js",
          "os": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/os.js",
          "path": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/path.js",
          "process": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/process.js",
          "props": "https://ga.system.jspm.io/npm:props@0.3.0/props.js",
          "read-metadata": "https://ga.system.jspm.io/npm:read-metadata@1.0.0/index.js",
          "sitemap": "https://ga.system.jspm.io/npm:sitemap@2.2.0/index.js",
          "slash": "https://ga.system.jspm.io/npm:slash@2.0.0/index.js",
          "supports-color": "https://ga.system.jspm.io/npm:supports-color@8.1.1/index.js",
          "to-function": "https://ga.system.jspm.io/npm:to-function@2.0.6/index.js",
          "tty": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/tty.js",
          "uniq": "https://ga.system.jspm.io/npm:uniq@1.0.1/uniq.js",
          "url-join": "https://ga.system.jspm.io/npm:url-join@4.0.1/lib/url-join.js",
          "util": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/util.js",
          "xmlbuilder": "https://ga.system.jspm.io/npm:xmlbuilder@10.1.1/lib/index.js",
          "xtend": "https://ga.system.jspm.io/npm:xtend@4.0.2/immutable.js",
          "yaml-js": "https://ga.system.jspm.io/npm:yaml-js@0.0.8/lib/yaml.js",
          "zlib": "https://ga.system.jspm.io/npm:@jspm/core@2.0.0-beta.7/nodelibs/zlib.js"
        },
        "https://ga.system.jspm.io/npm:debug@4.1.1/": {
          "ms": "https://ga.system.jspm.io/npm:ms@2.1.3/index.js"
        },
        "https://ga.system.jspm.io/npm:debug@4.3.2/": {
          "ms": "https://ga.system.jspm.io/npm:ms@2.1.2/index.js"
        },
        "https://ga.system.jspm.io/npm:metalsmith-markdown@1.3.0/": {
          "debug": "https://ga.system.jspm.io/npm:debug@4.3.2/src/index.js"
        },
        "https://ga.system.jspm.io/npm:metalsmith-publish@0.1.6/": {
          "debug": "https://ga.system.jspm.io/npm:debug@4.1.1/src/index.js"
        }
      }
    }`
      },
      {
        innerHTML: `
        System.import("metalsmith-collections").then(m => window.metalsmithCollections = m.default);
    System.import("metalsmith-debug").then(m => window.metalsmithDebug = m.default);
    System.import("metalsmith-mapsite").then(m => window.metalsmithMapsite = m.default);
    System.import("metalsmith-markdown").then(m => window.metalsmithMarkdown = m.default);
    System.import("metalsmith-more").then(m => window.metalsmithMore = m.default);
    System.import("metalsmith-pagination").then(m => window.metalsmithPagination = m.default);
    System.import("metalsmith-publish").then(m => window.metalsmithPublish = m.default);`
      }
    ]
  },

  /*
   ** Customize the progress-bar color
   */
  loading: { color: '#fff' },

  /*
   ** Plugins to load before mounting the App
   */
  plugins: [
    { src: '~/plugins/vuetify' },
    { src: '~plugins/nuxt-codemirror-plugin', ssr: false },
    { src: '~plugins/debounce-plugin' },
    { src: '~/plugins/auth-listeners' }
    // { src: '~/plugins/vuex-persist', ssr: false },
  ],

  /*
   ** Nuxt modules
   */
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    '@nuxtjs/axios',
    '@nuxtjs/auth'
  ],

  buildModules: [
    [
      '@nuxtjs/dotenv',
      { filename: process.env.NODE_ENV !== 'production' ? '.env' : 'prod.env' }
    ],
    ['@nuxtjs/router', { keepDefaultRouter: true }]
  ],
  /*
   ** Axios module configuration
   */
  axios: {
    // See https://github.com/nuxt-community/axios-module#options
  },

  auth: {
    rewriteRedirects: true,
    redirect: {
      login: '/login',
      logout: '/',
      callback: '/callback',
      home: '/admin'
    },
    plugins: ['~/plugins/octokit-plugin'],
    strategies: {
      githubProxy: {
        _scheme: 'oauth2',
        authorization_endpoint: 'https://github.com/login/oauth/authorize',
        access_token_endpoint:
          process.env.NODE_ENV !== 'production'
            ? process.env.APP_AZURE_FUNCTIONS_URL_DEV + '/api/handler/'
            : process.env.APP_AZURE_FUNCTIONS_URL + '/api/handler/',
        userinfo_endpoint: 'https://api.github.com/user',
        scope: ['repo', 'read:user'],
        response_type: 'code',
        token_type: 'Bearer',
        redirect_uri:
          process.env.NODE_ENV !== 'production'
            ? process.env.APP_AZURE_FUNCTIONS_URL_DEV + '/api/callback/'
            : process.env.APP_AZURE_FUNCTIONS_URL + '/api/callback/',
        client_id:
          process.env.NODE_ENV !== 'production'
            ? process.env.APP_CLIENT_ID_DEV
            : process.env.APP_CLIENT_ID,
        token_key: 'access_token'
      },
      local: false
    }
  },

  router: {
    middleware: ['auth']
  },

  vue: {
    config: {
      errorHandler: (err, vm, info) => {
        console.log(`Error: ${err.toString()}\nInfo: ${info}`)
      },
      devtools: true
    }
  },

  /*
   ** Replace ="/nuxt with ="../nuxt" so that the client works at root level and in a subfolder
   */
  hooks: {
    generate: {
      page(page) {
        if (process.env.NODE_ENV == 'production') {
          page.html = page.html.replace(/="\/nuxt/gi, '="../nuxt')
        }
      }
    }
  },

  /*
   ** Build configuration
   */
  build: {
    publicPath: '/nuxt/',
    transpile: ['vuetify/lib'],
    plugins: buildPlugins,

    /*
     ** You can extend webpack config here
     */
    extend(config, ctx) {
      // Run ESLint on save
      if (ctx.isDev && ctx.isClient) {
        config.module.rules.push({
          enforce: 'pre',
          test: /\.(js|vue)$/,
          loader: 'eslint-loader',
          exclude: /(node_modules)/
        })
        config.module.rules.push({
          test: /node_modules\\metalsmith-tags\\lib\\index\.js$/,
          loader: 'string-replace-loader',
          options: {
            search: 'var tag = String(rawTag).trim();',
            replace: `var tag = ''
            if (typeof rawTag === 'object') {
              tag = String(rawTag.name).trim();
            } else {
              tag = String(rawTag).trim();
            }`
          }
        })
        config.resolve.symlinks = false
      }
      if (ctx.isDev) {
        config.devtool = ctx.isClient ? 'source-map' : 'inline-source-map'
      }
    },
    // TODO: Make this work without plugin-transform-modules-commonjs, see: https://github.com/webpack/webpack/issues/4039
    babel: {
      plugins: [
        '@babel/plugin-transform-runtime',
        '@babel/plugin-transform-modules-commonjs'
      ]
    }
  }
}
