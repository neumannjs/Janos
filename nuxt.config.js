import path from 'path'
import webpack from 'webpack'
import VuetifyLoaderPlugin from 'vuetify-loader/lib/plugin'
import pkg from './package'
require('dotenv').config()

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
    '@nuxtjs/auth',
    [
      '@nuxtjs/dotenv',
      { filename: process.env.NODE_ENV !== 'production' ? '.env' : 'prod.env' }
    ]
  ],
  /*
  ** Axios module configuration
  */
  axios: {
    // See https://github.com/nuxt-community/axios-module#options
  },

  auth: {
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
          process.env.APP_AZURE_FUNCTIONS_URL + '/api/handler/',
        userinfo_endpoint: 'https://api.github.com/user',
        scope: ['repo', 'read:user'],
        response_type: 'code',
        token_type: 'Bearer',
        redirect_uri: process.env.APP_AZURE_FUNCTIONS_URL + '/api/callback/',
        client_id: '93af288610e66a7a64a9',
        token_key: 'access_token'
      },
      local: false
    }
  },

  router: {
    middleware: ['auth'],
    extendRoutes(routes, resolve) {
      routes.push({
        name: 'sf-admin',
        path: '/*/admin',
        component: resolve(__dirname, 'pages/admin.vue')
      })
      routes.push({
        name: 'sf-callback',
        path: '/*/callback',
        component: resolve(__dirname, 'pages/callback.vue')
      })
      routes.push({
        name: 'sf-create',
        path: '/*/create',
        component: resolve(__dirname, 'pages/create.vue')
      })
      routes.push({
        name: 'sf-login',
        path: '/*/login',
        component: resolve(__dirname, 'pages/login.vue')
      })
      routes.push({
        name: 'sf-select',
        path: '/*/select',
        component: resolve(__dirname, 'pages/select.vue')
      })
    }
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
  ** Build configuration
  */
  build: {
    publicPath: '/nuxt/',
    // devtools: true,
    transpile: ['vuetify/lib'],
    plugins: [
      new VuetifyLoaderPlugin(),
      new webpack.NormalModuleReplacementPlugin(/recursive-readdir/, function(
        resource
      ) {
        resource.request = path.resolve(__dirname, './plugins/readdir')
      }),
      new webpack.NormalModuleReplacementPlugin(/fs/, function(resource) {
        resource.request = path.resolve(__dirname, './plugins/fs')
      }),
      new webpack.NormalModuleReplacementPlugin(/co-fs-extra/, function(
        resource
      ) {
        resource.request = path.resolve(__dirname, './plugins/fs')
      }),
      new webpack.NormalModuleReplacementPlugin(/require-one/, function(
        resource
      ) {
        resource.request = path.resolve(__dirname, './plugins/require-one')
      }),
      new webpack.NormalModuleReplacementPlugin(/rimraf/, function(resource) {
        resource.request = path.resolve(__dirname, './plugins/rimraf')
      }),
      new webpack.NormalModuleReplacementPlugin(/stat-mode/, function(
        resource
      ) {
        resource.request = path.resolve(__dirname, './plugins/stat-mode')
      }),
      new webpack.NormalModuleReplacementPlugin(/uglify-js/, 'uglifyjs-browser')
    ],

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
