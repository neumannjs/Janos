const debug = require('debug')('store/github')
const sha1 = require('js-sha1')
const Hash = require('sha.js/sha1')
const { isBinary } = require('istextorbinary')

export const state = () => ({
  fileTree: [],
  repo: '',
  treeSha: '',
  newTreeSha: '',
  parentCommitSha: '',
  fileContents: [],
  devBuild: true,
  neumannssgSites: []
})

export const mutations = {
  setFileTree(state, payload) {
    state.fileTree = payload
  },
  setNeumannssgSites(state, payload) {
    state.neumannssgSites = payload
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
  }
}

export const actions = {
  async getRepo({ rootState, commit }) {
    const pagesDomain = rootState.auth.user.login.toLowerCase() + '.github.io'
    let pathName = window.location.pathname
    let repoName = pathName.substr(0, pathName.indexOf('/admin'))
    if (repoName.length == 0) {
      repoName = pagesDomain
    }
    let q = `user:${rootState.auth.user.login}+topic:neumannssg`
    let result = await this.$octoKit.search.repos({ q: q })
    if (
      result.data.items &&
      result.data.items.some(repo => repo.name == repoName)
    ) {
      debug(
        'Repository name  %s based on location path %s is a neumannssg repository',
        repoName,
        window.location.pathname
      )
      commit('setRepo', repoName)
    } else if (result.data.items && process.env.APP_ENV == 'development') {
      debug(
        'Development mode: Picking first neumannssg repo from Github: %s',
        result.data.items[0].name
      )
      repoName = result.data.items[0].name
      commit('setRepo', repoName)
    }
    let neumannSsgSites = result.data.items.map(site => {
      let adminUrl = ''
      if (pagesDomain == repoName.toLowerCase()) {
        adminUrl = 'https://' + pagesDomain + '/admin'
      } else {
        adminUrl = 'https://' + pagesDomain + '/' + site.name + '/admin'
      }
      return {
        name: site.name,
        url: adminUrl,
        active: site.name == repoName,
        neumannssg: true
      }
    })
    q = `repo:${rootState.auth.user.login}/${pagesDomain}`
    try {
      result = await this.$octoKit.search.repos({ q: q })
      if (result.data.items) {
        neumannSsgSites.push({
          name: pagesDomain,
          url: 'https://' + pagesDomain + '/admin',
          active: false,
          neumannssg: false
        })
      }
      debug('Search for personal Github Pages returned: %o', result)
    } catch (error) {
      debug('Search for personal Github Pages returned error: %o', error)
    }
    commit('setNeumannssgSites', neumannSsgSites)
    return repoName
  },

  async createRepo({ rootState, dispatch }, name) {
    dispatch(
      'status/addOrUpdateStatusItemAsync',
      {
        name: 'github',
        text: 'Creating new repo',
        icon: 'mdi-github',
        button: false,
        progress: { indeterminate: true }
      },
      { root: true }
    )
    debug('status: %o', rootState.status.statusItems)
    try {
      const response = await this.$octoKit.repos.createUsingTemplate({
        template_owner: process.env.APP_TEMPLATE_OWNER,
        template_repo: process.env.APP_TEMPLATE_REPO,
        name
      })
      debug('Create new NeumannSsg repo: %o', response)
      if (response.status == 201) {
        dispatch(
          'status/addOrUpdateStatusItemAsync',
          {
            name: 'github',
            text: 'Add topic',
            icon: 'mdi-github',
            button: false,
            progress: { indeterminate: false, value: 33 }
          },
          { root: true }
        )
        // repo is created, now add topic (to be able to distinguish neumannssg repo's later on)
        const responseTopics = await this.$octoKit.repos.replaceAllTopics({
          owner: rootState.auth.user.login,
          repo: name,
          names: ['neumannssg']
        })
        debug(
          'Add topic neumannssg to repo %s/%s : %o',
          rootState.auth.user.login,
          name,
          responseTopics
        )
        // enable pages
        dispatch(
          'status/addOrUpdateStatusItemAsync',
          {
            name: 'github',
            text: 'Enable pages',
            icon: 'mdi-github',
            button: false,
            progress: { indeterminate: false, value: 66 }
          },
          { root: true }
        )
        try {
          // This github call always throws an error, so we should ignore it
          const responsePages = await this.$octoKit.repos.enablePagesSite({
            owner: rootState.auth.user.login,
            repo: name,
            source: {
              branch: 'master',
              path: '/docs'
            }
          })
          debug(
            'Enabling Github Pages for %s/%s did not return an error (Github fixed this?). response : %o',
            rootState.auth.user.login,
            name,
            responsePages
          )
        } catch (error) {
          debug(
            'Enabling Github Pages for %s/%s returned an eror (issue with Github API). error: %o',
            rootState.auth.user.login,
            name,
            error
          )
        }
        dispatch(
          'status/addOrUpdateStatusItemAsync',
          {
            name: 'github',
            text: 'new repo created',
            icon: 'mdi-github',
            button: false,
            progress: { indeterminate: false, value: 100 }
          },
          { root: true }
        )
        const pagesDomain =
          rootState.auth.user.login.toLowerCase() + '.github.io'
        let repoUrl = 'https://' + pagesDomain + '/'
        if (pagesDomain != name) {
          repoUrl += name + '/'
        }
        dispatch(
          'status/addNotificationAsync',
          {
            title: 'New repo created',
            subTitle: `New repo created <a href="${repoUrl}admin" target="_blank">${name}</a>`
          },
          { root: true }
        )
        setTimeout(function() {
          dispatch(
            'status/addOrUpdateStatusItemAsync',
            {
              name: 'github',
              text: 'idle',
              icon: 'mdi-github',
              button: false
            },
            { root: true }
          )
        }, 6000)
      }
    } catch (error) {
      throw error
    }
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
