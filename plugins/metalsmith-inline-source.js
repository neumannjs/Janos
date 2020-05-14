// https://regex101.com/r/dDv1ez/6/
// Original source https://www.regextester.com/94254 , but I like regex101 better and I made some adjustment
/**
 * Attribution: https://github.com/borisovg/metalsmith-inline-css
 */

let debug = require('debug')

const debugMain = debug('metalsmith-inline-source:main')
const debugParser = debug('metalsmith-inline-source:parser')

let relativeUrlRe = new RegExp(
  /(?:url\(|<(?:link|script|img)[^>]+(?:src|href)\s*=\s*)(?!['"]?(?:data|http|\/\/))['"]?([^'")\s>]+)['"]?[^>;]*\/?(?:\)|>(<\/script>)?)/
)

let javaScriptRe = new RegExp(/<script/)
let cssRe = new RegExp(/rel\s*=\s*["']{1}stylesheet["']{1}/)
let imgRe = new RegExp(/<img/)

function parse(htmlFile, files, destinationFolder = '') {
  let html = new TextDecoder('utf-8').decode(htmlFile.data.contents)
  let idx = 0
  let match = html.match(relativeUrlRe)
  let inlineFile, changed, findFile

  while (match) {
    if (match[1].substr(0, 1) === '/') {
      findFile = '/' + destinationFolder + match[1]
    } else {
      // TODO Check whether this works. Currently there are no testc ases for this.
      findFile = htmlFile.path + '/' + match[1]
    }
    inlineFile = files[findFile]
    debugParser('match: %s => %s', match[0], findFile)

    if (inlineFile) {
      if (match[0].match(javaScriptRe)) {
        let replacement =
          '<script type="text/javascript">' +
          new TextDecoder('utf-8').decode(inlineFile.contents) +
          '</script>'
        html = html.replace(match[0], replacement.replace(/\$/g, '$$$')) //Escape backreferencing $& and $1, $2, etc.
        debugParser('javascript inlined %s <= %s', htmlFile.name, findFile)
        debugParser(
          'indexOf /scripts/vendor.js: %i',
          html.indexOf('/scripts/vendor.js')
        )
        idx += match.index + replacement.length
        changed = true
      } else if (match[0].match(cssRe)) {
        let replacement =
          '<style>' +
          new TextDecoder('utf-8').decode(inlineFile.contents) +
          '</style>'
        html = html.replace(match[0], replacement)
        debugParser('css inlined %s <= %s', htmlFile.name, findFile)
        idx += match.index + replacement.length
        changed = true
      } else if (match[0].match(imgRe)) {
        const extension = findFile.substring(findFile.lastIndexOf('.') + 1)
        html = html.replace(
          match[1],
          'data:image/' +
            extension +
            ';base64, ' +
            new TextDecoder('utf-8').decode(inlineFile.contents)
        )
        debugParser('image inlined %s <= %s', htmlFile.name, findFile)
        changed = true
      } else {
        //ignore match
        debugParser('%s found in %s, but ignored', findFile, htmlFile.name)
        idx += match.index + match[0].length
      }
    } else {
      debugParser('%s not found, wanted by %s', findFile, htmlFile.name)
      idx += match.index + match[0].length
    }

    match = html.substr(idx).match(relativeUrlRe)
  }

  if (changed) {
    htmlFile.data.contents = new TextEncoder().encode(html)
  }
}

function plugin() {
  return function(files, metalsmith, done) {
    debugMain('Files object %o', files)
    let htmlFiles = []
    let htmlRe = new RegExp('.html$')
    let i, name

    for (name in files) {
      if (files.hasOwnProperty(name)) {
        if (name.match(htmlRe)) {
          htmlFiles.push({ name: name, data: files[name] })
        }
      }
    }

    debugMain('parse start')

    for (i = 0; i < htmlFiles.length; i += 1) {
      parse(htmlFiles[i], files, metalsmith._destination)
    }

    debugMain('parse end')

    done()
  }
}

module.exports = plugin
