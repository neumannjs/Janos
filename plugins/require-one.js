const JstransformerMarkdown = require('jstransformer-markdown')
const JstransformerNunjucks = require('jstransformer-nunjucks')

module.exports = function requireOne(packages) {
  // Retrieve the list of package names.
  const packagesNames = Array.isArray(packages) ? packages : arguments
  for (const i in packagesNames) {
    if (packagesNames[i]) {
      try {
        switch (packagesNames[i]) {
          case 'jstransformer-markdown':
            return JstransformerMarkdown
          case 'jstransformer-nunjucks':
            return JstransformerNunjucks
        }
      } catch (err) {
        // Do nothing, but continue on to the next package.
        continue
      }
    }
  }
  throw new Error(
    'Could not found one of the expected packages: ' + JSON.stringify(packages)
  )
}
