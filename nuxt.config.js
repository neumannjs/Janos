import path from 'path'
import webpack from 'webpack'
import VuetifyLoaderPlugin from 'vuetify-loader/lib/plugin'
import pkg from './package'

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
      },
      {
        rel: 'stylesheet',
        href:
          'https://cdn.materialdesignicons.com/5.2.45/css/materialdesignicons.min.css'
      }
    ]
  },

  /*
  ** Customize the progress-bar color
  */
  loading: { color: '#fff' },

  /*
  ** Global CSS
  */
  css: ['~/assets/style/app.styl'],

  /*
  ** Plugins to load before mounting the App
  */
  plugins: [
    { src: '~/plugins/vuetify' },
    { src: '~plugins/nuxt-codemirror-plugin', ssr: false },
    { src: '~plugins/debounce-plugin' },
    { src: '~plugins/best-base64-encoder-decoder' },
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
    '@nuxtjs/dotenv'
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
        access_token_endpoint: 'http://localhost:7071/api/handler/',
        userinfo_endpoint: 'https://api.github.com/user',
        scope: ['repo', 'read:user'],
        response_type: 'code',
        token_type: 'Bearer',
        redirect_uri: 'http://localhost:7071/api/callback/',
        client_id: '93af288610e66a7a64a9',
        token_key: 'access_token'
      }
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
  ** Build configuration
  */
  build: {
    // publicPath: 'nuxt/',
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
    loaders: {
      stylus: {
        import: ['~assets/style/variables.styl']
      }
    },

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
