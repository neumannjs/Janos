module.exports = function babelConfig(api) {
  api.cache(true)
  return {
    env: {
      test: {
        presets: [
          [
            '@babel/preset-env',
            {
              targets: {
                node: 'current'
              }
            }
          ],
          '@nuxt/babel-preset-app'
        ]
      }
    }
  }
}
