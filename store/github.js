const debug = require('debug')('store/github')
const sha1 = require('js-sha1')
const Hash = require('sha.js/sha1')
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
const { isBinary } = require('istextorbinary')
const cssChangeUrl = require('../plugins/metalsmith-css-change-url')
const sourceUrl = require('../plugins/metalsmith-sourceurl')
const writeBuiltUrl = require('../plugins/metalsmith-write-builturl')
const inlineSource = require('../plugins/metalsmith-inline-source')
const pkg = require('../package.json')

export const state = () => ({
  fileTree: [],
  repo: '',
  treeSha: '',
  newTreeSha: '',
  parentCommitSha: '',
  fileContents: [],
  devBuild: false
})

export const mutations = {
  setFileTree(state, payload) {
    state.fileTree = payload
  },
  setRepo(state, payload) {
    state.repo = payload
  },
  setTreeSha(state, payload) {
    state.treeSha = payload
  },
  setNewTreeSha(state, payload) {
    state.newTreeSha = payload
  },
  setParentCommitSha(state, payload) {
    state.parentCommitSha = payload
  },
  addFile(state, payload) {
    const file = state.fileContents.find(f => f.path === payload.path)
    if (file === undefined) {
      calculateSha1(payload)
      state.fileContents.push(payload)
    }
  },
  addNodeToTree(state, { parent, node }) {
    if (parent.constructor === Array) {
      parent.push(node)
    } else if (parent.children) {
      parent.children.push(node)
    } else {
      parent.children = [node]
    }
  },
  renameNode(state, { item, fileName }) {
    if (fileName.length > 0) {
      let folder = item.path.substring(0, item.path.lastIndexOf('/'))
      if (folder.charAt(0) === '/') {
        folder = folder.substring(1)
      }
      item.name = fileName
      item.path = folder + '/' + fileName
      if (item.type === 'newfile') {
        item.type = 'blob'
      } else if (item.type === 'newfolder') {
        item.type = 'tree'
      }
    }
  },
  setBinaryKey(state, { file, isBinary }) {
    file.binary = isBinary
  },
  deleteFileFromTree(state, { parent, index }) {
    parent.splice(index, 1)
  },
  deleteChildren(state, folder) {
    state.fileContents = state.fileContents.filter(file => {
      return file.path.substring(0, folder.path.length) !== folder.path
    })
    if (folder.children) {
      folder.children = []
    }
  },
  updateFileContent(state, { content, path, builtFile }) {
    const file = state.fileContents.find(f => f.path === path)
    file.content = content
    if (builtFile) {
      file.builtFile = builtFile
    }
    calculateSha1(file)
  },
  switchDevBuild(state) {
    state.devBuild = !state.devBuild
  }
}

export const actions = {
  async getRepo({ rootState, commit }) {
    const q = `user:${rootState.auth.user.login}+topic:neumannssg`
    const result = await this.$octoKit.search.repos({ q: q })
    commit('setRepo', result.data.items[0].name)
    return result.data.items[0].name
  },

  async getFileTree(
    { rootState, state, commit },
    { force } = { force: false }
  ) {
    if (state.fileTree.length === 0 || force) {
      const result = await this.$octoKit.git.getTree({
        owner: rootState.auth.user.login,
        repo: state.repo,
        tree_sha: state.treeSha,
        recursive: 1
      })
      const fileTree = []
      debug('getFileTree result.data.tree: %j', result.data.tree)
      result.data.tree.forEach(object => {
        if (object.type === 'blob') {
          object.binary = isBinary(object.path)
        }
        addTreeItem(object.path, object, fileTree)
      })
      commit('setFileTree', fileTree)
    } else {
      return state.fileTree
    }
  },

  async getTreeSha({ rootState, state, commit }) {
    const result = await this.$octoKit.repos.listCommits({
      owner: rootState.auth.user.login,
      repo: state.repo,
      per_page: 1
    })
    commit('setTreeSha', result.data[0].commit.tree.sha)
    commit('setParentCommitSha', result.data[0].sha)
    return result.data[0].commit.tree.sha
  },

  addEmptyFile({ commit }, file) {
    return new Promise((resolve, reject) => {
      commit('addFile', {
        content: btoa(''),
        ...file
      })
      resolve()
    })
  },

  updateFileContent({ commit, dispatch, state }, { content, path, builtFile }) {
    return new Promise(async (resolve, reject) => {
      let file = await dispatch('getFile', path)
      if (file !== undefined) {
        commit('updateFileContent', {
          content,
          path,
          builtFile
        })
      } else {
        const fileTree = JSON.parse(JSON.stringify(state.fileTree))
        const parent = findOrCreateParent(fileTree, path)
        const contentIsBinary = isBinary(null, Buffer.from(content, 'base64'))
        commit('setFileTree', fileTree)
        const fileNode = await dispatch('addNodeToTree', {
          parent,
          name: path.substr(parent.path.length + 1),
          type: 'blob',
          binary: contentIsBinary
        })
        file = {
          content: content,
          ...fileNode
        }
        commit('addFile', file)
      }
      resolve(file)
    })
  },

  async getFile({ rootState, state, commit }, path) {
    const file = state.fileContents.find(f => f.path === path)
    if (file !== undefined) {
      return file
    }
    try {
      let fileObject
      const treeFile = findFileRecursive(state.fileTree, path)
      if (treeFile !== undefined) {
        // fileTree only contains files that are in the github repository, or that are manually created in the browser
        const result = await this.$octoKit.git.getBlob({
          owner: rootState.auth.user.login,
          repo: state.repo,
          file_sha: treeFile.sha
        })
        if (!('binary' in treeFile) || treeFile.binary === null) {
          commit('setBinaryKey', {
            file: treeFile,
            isBinary: isBinary(null, Buffer.from(result.data.content, 'base64'))
          })
        }
        fileObject = {
          ...treeFile,
          ...result.data
        }
        if (path.indexOf('.md') > -1) {
          debug('getFile: %s', path)
          debug('getFile, file size: %i', fileObject.size)
          debug('getFile, file sha: %s', fileObject.sha)
          const raw = atob(fileObject.content)
          debug('getFile, length of raw content: ' + raw.length)
          const bytes = new Uint8Array(raw.length)
          for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i)
          }
          const wrapObject = wrap('blob', bytes.buffer)
          debug('getFile, shasum of wrapObject: %s', shasum(wrapObject))
          debug('getFile, sha1 of wrapObject: %s', sha1(wrapObject))
        }
        commit('addFile', fileObject)
      }
      return fileObject
    } catch (err) {
      return err.message
    }
  },

  addNodeToTree({ commit }, { parent, name, type, binary }) {
    return new Promise((resolve, reject) => {
      let path
      if (parent.path) {
        path = parent.path + '/' + name
      } else {
        path = name
      }
      const node = {
        mode: '100644',
        path,
        name,
        size: 0,
        type,
        url: '',
        binary
      }
      if (type === 'tree') {
        node.mode = '040000'
        node.children = []
        delete node.binary
      }
      if (name === '' && type === 'blob') {
        node.name = 'newfile'
        node.type = 'newfile'
      } else if (name === '' && type === 'tree') {
        node.name = 'newfolder'
        node.type = 'newfolder'
      }
      commit('addNodeToTree', { parent, node })
      resolve(node)
    })
  },

  removeFileFromTree({ state, commit }, file) {
    const parent = findParentRecursive(state.fileTree, file)
    commit('deleteFileFromTree', { parent, index: parent.indexOf(file) })
  },

  renameNode({ state, commit }, { item, fileName }) {
    return new Promise((resolve, reject) => {
      commit('renameNode', { item, fileName })
      resolve(item.path)
    })
  },

  createGitTree({ rootState, state, commit }) {
    return new Promise((resolve, reject) => {
      createGitTreeRecursive(
        state.fileTree,
        state.fileContents,
        this.$octoKit,
        { owner: rootState.auth.user.login, repo: state.repo }
      ).then(async gitTree => {
        debug('createGitTree: %j', gitTree)
        const result = await this.$octoKit.git.createTree({
          owner: rootState.auth.user.login,
          repo: state.repo,
          tree: gitTree
        })
        commit('setNewTreeSha', result.data.sha)
        resolve()
      })
    })
  },

  createGitCommit({ rootState, state, commit }) {
    return new Promise(async (resolve, reject) => {
      let result = await this.$octoKit.git.createCommit({
        owner: rootState.auth.user.login,
        repo: state.repo,
        message: 'Dit is een commit vanuit Vue',
        tree: state.newTreeSha,
        parents: [state.parentCommitSha]
      })
      commit('setTreeSha', state.newTreeSha)
      commit('setParentCommitSha', result.data.sha)
      commit('setNewTreeSha', '')
      result = await this.$octoKit.git.updateRef({
        owner: rootState.auth.user.login,
        repo: state.repo,
        ref: 'heads/master',
        sha: result.data.sha
      })
      resolve()
    })
  },

  clearFolder({ state, commit }, folder) {
    return new Promise((resolve, reject) => {
      const treeFolder = findFileRecursive(state.fileTree, folder)
      if (treeFolder) {
        commit('deleteChildren', treeFolder)
      }
      resolve()
    })
  },

  runMetalsmith({ rootState, state, dispatch }) {
    const prodDomain = rootState.auth.user.login + '.github.io'
    let prodRootPath = null
    if (prodDomain !== state.repo) {
      prodRootPath = '/' + state.repo + '/'
    }
    const devHost = 'localhost'
    const devPort = 3000
    const siteMeta = {
      version: pkg.version,
      name: 'Neumann SSG',
      description: 'A demonstration static site built using Neumann SSG',
      author: 'Gijs van Dam',
      contact: 'https://twitter.com/gijswijs',
      domain: state.devBuild ? 'http://' + devHost + ':' + devPort : prodDomain, // set domain
      rootpath: state.devBuild ? '/' : prodRootPath // set absolute path (null for relative)
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
                    const file = await dispatch('getFile', fileName)
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

function findParentRecursive(array, file) {
  if (array.findIndex(i => i.path === file.path) > -1) {
    return array
  }

  for (let i = 0; i < array.length; i++) {
    if (array[i].children) {
      const ret = findParentRecursive(array[i].children, file)
      if (ret !== undefined) {
        return ret
      }
    }
  }
}

function findOrCreateParent(parent, path) {
  if (path.indexOf('/') === -1) {
    return parent
  } else {
    let array
    if (parent.constructor === Array) {
      array = parent
    } else {
      array = parent.children
    }
    const folder = path.substring(0, path.indexOf('/'))
    const indexOfFolder = array.findIndex(
      i => i.name === folder && i.type === 'tree'
    )
    if (indexOfFolder === -1) {
      // folder niet gevonden, maak folder
      let folderPath = ''
      if (parent.path) {
        folderPath = parent.path
      }
      const folderObject = {
        children: [],
        mode: '040000',
        name: folder,
        path: folderPath + '/' + folder,
        type: 'tree'
      }
      if (folderObject.path.charAt(0) === '/') {
        folderObject.path = folderObject.path.substring(1)
      }
      array.push(folderObject)
      path = path.substring(path.indexOf('/') + 1)
      return findOrCreateParent(folderObject, path)
    } else {
      path = path.substring(path.indexOf('/') + 1)
      return findOrCreateParent(array[indexOfFolder], path)
    }
  }
}

function findFileRecursive(array, path) {
  if (array.findIndex(f => f.path === path) > -1) {
    return array[array.findIndex(f => f.path === path)]
  }
  for (let i = 0; i < array.length; i++) {
    if (array[i].children) {
      const ret = findFileRecursive(array[i].children, path)
      if (ret !== undefined) {
        return ret
      }
    }
  }
}

function createGitTreeRecursive(filetree, editedFiles, octokit, octokitConfig) {
  return new Promise(async (resolve, reject) => {
    const ret = []
    let todo = 0
    for (let i = 0; i < filetree.length; i++) {
      if (filetree[i].type === 'blob') {
        todo += 1
        const editedFile = editedFiles.find(f => f.path === filetree[i].path)
        if (editedFile === undefined || !editedFile.newSha) {
          ret.push({
            path: filetree[i].path,
            mode: filetree[i].mode,
            type: filetree[i].type,
            sha: filetree[i].sha
          })
          todo -= 1
        } else {
          octokit.git
            .createBlob({
              owner: octokitConfig.owner,
              repo: octokitConfig.repo,
              content: editedFile.content,
              encoding: 'base64'
            })
            .then(result => {
              debug('createGitTreeRecursive octokit.git.createBlob: %j', result)
              ret.push({
                path: filetree[i].path,
                mode: filetree[i].mode,
                type: filetree[i].type,
                sha: result.data.sha
              })
              todo -= 1
            })
        }
      }
      if (filetree[i].children) {
        const result = await createGitTreeRecursive(
          filetree[i].children,
          editedFiles,
          octokit,
          octokitConfig
        )
        ret.push(...result)
      }
    }
    const interval = setInterval(function() {
      debug(
        'createGitTreeRecursive: Still waiting for %i octokit.git.createBlob calls to finish.',
        todo
      )
      if (todo === 0) {
        clearInterval(interval)
        resolve(ret)
      }
    }, 500)
  })
}

function addTreeItem(path, object, array) {
  if (path.indexOf('/') > 0) {
    const folder = path.substring(0, path.indexOf('/'))
    const folderObject = array.find(o => o.name === folder)

    if (!folderObject.children) {
      folderObject.children = []
    }
    path = path.substring(path.indexOf('/') + 1)
    addTreeItem(path, object, folderObject.children)
  } else {
    array.push({
      name: path,
      ...object
    })
  }
}

function calculateSha1(file) {
  const contents = atob(file.content)
  const bytes = new Uint8Array(contents.length)
  file.size = contents.length
  for (let i = 0; i < contents.length; i++) {
    bytes[i] = contents.charCodeAt(i)
  }
  const wrapObject = wrap('blob', bytes.buffer)
  const sha = sha1(wrapObject)
  if (file.sha) {
    if (file.sha !== sha) {
      file.newSha = sha
    } else if (file.newSha) {
      delete file.newSha
    }
  } else {
    file.newSha = sha
  }
}

// function lengthInUtf8Bytes(str) {
//   const m = encodeURIComponent(str).match(/%[89ABab]/g)
//   return str.length + (m ? m.length : 0)
// }

function shasum(buffer) {
  return new Hash().update(buffer).digest('hex')
}

function wrap(type, object) {
  return Buffer.concat([
    Buffer.from(`${type} ${object.byteLength.toString()}\x00`),
    Buffer.from(object)
  ])
}
