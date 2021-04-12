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

if (process.env.NODE_ENV === 'production') {
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
  ssr: false,

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
      login: '../login',
      logout: '/',
      callback: '/callback',
      home: '../admin'
    },
    plugins: ['~/plugins/octokit-plugin'],
    strategies: {
      githubProxy: {
        _scheme: 'oauth2',
        authorization_endpoint:
          process.env.NODE_ENV !== 'production'
            ? process.env.APP_AZURE_FUNCTIONS_URL_DEV + '/api/authorize/'
            : process.env.APP_AZURE_FUNCTIONS_URL + '/api/authorize/',
        access_token_endpoint:
          process.env.NODE_ENV !== 'production'
            ? process.env.APP_AZURE_FUNCTIONS_URL_DEV + '/api/handler/'
            : process.env.APP_AZURE_FUNCTIONS_URL + '/api/handler/',
        userinfo_endpoint: 'https://api.github.com/user',
        scope: ['repo', 'read:user'],
        response_type: 'code',
        token_type: 'Bearer',
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
        if (process.env.NODE_ENV === 'production') {
          page.html = page.html.replace(/"\/nuxt/gi, '"../nuxt')
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
    devMiddleware: { mimeTypes: { wasm: 'application/wasm' } },
    /*
     ** You can extend webpack config here
     */
    extend(config, ctx) {
      config.module.rules.push({
        test: /\.js$/,
        loader: require.resolve('@open-wc/webpack-import-meta-loader')
      })
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'javascript/auto',
        loader: 'file-loader'
      })
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
    }
  }
}
