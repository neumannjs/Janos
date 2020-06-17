import Vue from 'vue'
const debug = require('debug')('store/github')
const sha1 = require('js-sha1')
// const Hash = require('sha.js/sha1')
const { isBinary } = require('istextorbinary')
const { btoaUTF8 } = require('bestbase64utf8')

export const state = () => ({
  fileTree: [],
  repo: '',
  treeSha: '',
  newTreeSha: '',
  parentCommitSha: '',
  fileContents: [],
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
      let entry = findFileRecursive(state.fileTree, payload.path)
      entry.sha = calculateSha1(payload)
      calculateSha1(payload)
      state.fileContents.push(payload)
    }
  },
  setFileOpened(state, { file, value }) {
    if (value) {
      Vue.set(file, 'opened', value)
    } else {
      Vue.delete(file, 'opened')
    }
  },
  addNodeToTree(state, { parent, node }) {
    if (parent.constructor === Array) {
      state.fileTree.push(node)
    } else {
      let parentRef = findFileRecursive(state.fileTree, parent.path)
      if (parentRef.children) {
        parentRef.children.push(node)
      } else {
        parentRef.children = [node]
      }
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
    let entry = findFileRecursive(state.fileTree, file.path)
    entry.sha = calculateSha1(file)
    calculateSha1(file)
  }
}

export const actions = {
  async searchTemplates({ rootState, commit }, searchTerm) {
    let q = `${searchTerm}+topic:neumannssg-template`
    let result = await this.$octoKit.search.repos({ q: q })
    let templates = result.data.items.map(template => {
      return {
        name: template.name,
        full_name: template.full_name,
        thumbnail:
          'https://raw.githubusercontent.com/' +
          template.full_name +
          '/master/thumbnail.jpg'
      }
    })
    return templates
  },
  async addSubTree({ dispatch, commit, state, rootState }, fullName) {
    //Poor man's subtree command (it just copies files from one repo to another)
    const owner = fullName.split('/')[0]
    const repo = fullName.split('/')[1]
    //create subfolder in layouts folder
    addTreeItem(
      '_layouts/' + repo,
      { mode: '040000', name: repo, path: '_layouts/' + repo, type: 'tree' },
      state.fileTree
    )
    debug('Get git tree sha of the latest commit for %s.', fullName)
    const resultCommits = await this.$octoKit.repos.listCommits({
      owner,
      repo,
      per_page: 1
    })
    const tree_sha = resultCommits.data[0].commit.tree.sha
    debug('Get git tree for repo %s wit tree sha %s.', fullName, tree_sha)
    const result = await this.$octoKit.git.getTree({
      owner,
      repo,
      tree_sha,
      recursive: 1
    })
    result.data.tree.forEach(async object => {
      object.path = '_layouts/' + repo + '/' + object.path
      if (object.type === 'blob') {
        //get blob
        debug('Get blob for path %s with sha %s.', object.path, object.sha)
        const blob = await this.$octoKit.git.getBlob({
          owner,
          repo,
          file_sha: object.sha
        })
        //create blob
        debug('Create blob for path %s.', object.path)
        await this.$octoKit.git.createBlob({
          owner: rootState.auth.user.login,
          repo: state.repo,
          content: blob.data.content,
          encoding: 'base64'
        })
        object.binary = isBinary(
          object.path,
          Buffer.from(blob.data.content, 'base64')
        )
      }
      debug('Add node in treeview for path %s.', object.path)
      addTreeItem(object.path, object, state.fileTree)
      dispatch('createGitTree').then(() => {
        dispatch('createGitCommit', {
          message: 'Copied repo ' + fullName + ' into _layouts folder'
        })
      })
    })
  },
  async getRepo({ rootState, commit }) {
    const pagesDomain = rootState.auth.user.login.toLowerCase() + '.github.io'
    let pathName = window.location.pathname
    let repoName = pathName.substring(1, pathName.indexOf('/admin'))
    if (repoName === '/') {
      repoName = pagesDomain
    }
    let q = `user:${rootState.auth.user.login}+topic:neumannssg`
    let result = await this.$octoKit.search.repos({ q: q })
    debug(
      'pagesDomain: %s ; pathName: %s ; repoName: %s ; q: %s ; result: %o ',
      pagesDomain,
      pathName,
      repoName,
      q,
      result
    )
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

  async createRepo({ rootState, commit, dispatch }, name) {
    commit(
      'status/addOrUpdateStatusItem',
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
        commit(
          'status/addOrUpdateStatusItem',
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
        commit(
          'status/addOrUpdateStatusItem',
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
              path: ''
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
        commit(
          'status/addOrUpdateStatusItem',
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
          'status/addNotification',
          {
            title: 'New repo created',
            subTitle: `New repo created <a href="${repoUrl}admin" target="_blank">${name}</a>`
          },
          { root: true }
        )
        setTimeout(function() {
          commit(
            'status/addOrUpdateStatusItem',
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
        content: '',
        encoding: 'utf-8',
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
        const contentIsBinary = isBinary(path, Buffer.from(content, 'base64'))
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
        if (!contentIsBinary) {
          file.encoding = 'utf-8'
        }
        commit('addFile', file)
      }
      resolve(file)
    })
  },

  async getFile({ rootState, state, commit }, path) {
    debug('getFile will try to find file with path %s.', path)
    if (path[0] === '/') {
      path = path.substr(1)
    }
    let file = state.fileContents.find(f => f.path === path)
    if (file == undefined) {
      try {
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
              isBinary: isBinary(
                path,
                Buffer.from(result.data.content, 'base64')
              )
            })
          }
          file = {
            ...treeFile,
            ...result.data
          }
          if (!file.binary) {
            debug('File %s is not binary, so decode base64 content.', file.path)
            // Convert non-binary files from base64 to string (utf-8)
            // TODO: Check whether the Unicode problem still is relevant: <https://stackoverflow.com/a/30106551>
            file.content = atob(file.content)
            file.encoding = 'utf-8'
          }
          // if (path.indexOf('.md') > -1) {
          //   debug('getFile: %s', path)
          //   debug('getFile, file size: %i', fileObject.size)
          //   debug('getFile, file sha: %s', fileObject.sha)
          //   const raw = atob(fileObject.content)
          //   debug('getFile, length of raw content: ' + raw.length)
          //   const bytes = new Uint8Array(raw.length)
          //   for (let i = 0; i < raw.length; i++) {
          //     bytes[i] = raw.charCodeAt(i)
          //   }
          //   const wrapObject = wrap('blob', bytes.buffer)
          //   debug('getFile, shasum of wrapObject: %s', shasum(wrapObject))
          //   debug('getFile, sha1 of wrapObject: %s', sha1(wrapObject))
          // }
          commit('addFile', file)
        }
      } catch (err) {
        return err.message
      }
    }
    debug('getFile will return the following file object: %o', file)
    return file
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
    debug('Remove file from tree with path %s', file.path)
    const parent = findParentRecursive(state.fileTree, file)
    commit('deleteFileFromTree', { parent, index: parent.indexOf(file) })
  },

  renameNode({ state, commit }, { item, fileName }) {
    return new Promise((resolve, reject) => {
      commit('renameNode', { item, fileName })
      resolve(item.path)
    })
  },

  async createGitTree({ rootState, state, commit }) {
    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'github',
        text: 'Create Git tree',
        icon: 'mdi-github',
        button: false,
        progress: { indeterminate: true }
      },
      { root: true }
    )

    let createBlobs = state.fileContents
      .filter(file => file.newSha)
      .map(editedFile => {
        debug('Create blob for %s', editedFile.path)
        let content = editedFile.content
        if (editedFile.encoding && editedFile.encoding === 'utf-8') {
          content = btoaUTF8(content)
        }
        return this.$octoKit.git
          .createBlob({
            owner: rootState.auth.user.login,
            repo: state.repo,
            content,
            encoding: 'base64'
          })
          .then(result => {
            if (editedFile.newSha != result.data.sha) {
              debug(
                'sha mismatch for file %s! Our sha: %s ; Theirs %o',
                editedFile.path,
                editedFile.newSha,
                result
              )
            }
          })
      })

    await Promise.all(createBlobs)

    debug('New blobs created')

    let gitTree = state.fileContents
      .filter(file => file.newSha)
      .map(editedFile => {
        return {
          path: editedFile.path,
          mode: editedFile.mode,
          type: editedFile.type,
          sha: editedFile.newSha
        }
      })

    debug('Changed tree objects: %o', gitTree)

    const result = await this.$octoKit.git.createTree({
      owner: rootState.auth.user.login,
      repo: state.repo,
      tree: gitTree,
      base_tree: state.treeSha
    })

    debug('gitTree created: %o', result.data)

    commit('setNewTreeSha', result.data.sha)

    state.fileContents.forEach(file => {
      if (file.newSha) {
        Vue.delete(file, 'newSha')
      }
    })

    return result
  },

  async createGitCommit({ rootState, state, commit, getters }, { message }) {
    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'github',
        text: 'Create Git commit',
        icon: 'mdi-github',
        button: false,
        progress: { indeterminate: false, value: 50 }
      },
      { root: true }
    )
    debug(
      'Create commit for repo %s/%s and tree %s.',
      rootState.auth.user.login,
      state.repo,
      state.newTreeSha
    )
    let result = await this.$octoKit.git.createCommit({
      owner: rootState.auth.user.login,
      repo: state.repo,
      message,
      tree: state.newTreeSha,
      parents: [state.parentCommitSha]
    })
    debug(
      'New commit created for repo %s/%s with sha %s',
      rootState.auth.user.login,
      state.repo,
      result.data.sha
    )
    commit('setTreeSha', state.newTreeSha)
    commit('setParentCommitSha', result.data.sha)
    commit('setNewTreeSha', '')
    debug('Updated treeSha with value of newTreeSha: %s', state.treeSha)
    result = await this.$octoKit.git.updateRef({
      owner: rootState.auth.user.login,
      repo: state.repo,
      ref: 'heads/master',
      sha: result.data.sha
    })
    debug('Updated reference of `heads/master` with result: %o', result)
    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'github',
        text: 'Git commit created',
        icon: 'mdi-github',
        button: false,
        progress: { indeterminate: false, value: 100 }
      },
      { root: true }
    )
    setTimeout(function() {
      commit(
        'status/addOrUpdateStatusItem',
        {
          name: 'github',
          text: 'idle',
          icon: 'mdi-github',
          button: false
        },
        { root: true }
      )
    }, 6000)
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

export const getters = {
  numberOfChangedFiles: state => {
    return state.fileContents.filter(file => file.newSha).length
  },
  openFiles: state => {
    return state.fileContents.filter(file => file.opened)
  }
}

function findParentRecursive(array, file) {
  // This function is sued to find and return the parent of a file.
  // This is needed to delete the file itself, knowing the array it is contained by.
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

function findOrCreateParent(tree, path) {
  if (path.indexOf('/') === -1) {
    // The file is at the root, the parent is the tree itself
    return tree
  } else {
    let array
    if (tree.constructor === Array) {
      // We are at the root of the fileTree (which is an array itself)
      // the array to use *is* the filetree
      array = tree
    } else {
      // We are in a branche of the filetree.
      // The array to use is the array that contains the children of the current branch
      array = tree.children
    }
    // Get the first folder of the path
    const folder = path.substring(0, path.indexOf('/'))
    // Find that folder in the array
    const indexOfFolder = array.findIndex(
      i => i.name === folder && i.type === 'tree'
    )
    if (indexOfFolder === -1) {
      // Create the folder when it is not found
      // UPDATE 20200625: I'm not sure whether this actually needed anymore.
      // When bbuilt there were situations where the file got updated before the folder was created
      // In these cases creating a folder that could not be found was useful.
      let folderPath = ''
      if (tree.path) {
        folderPath = tree.path
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
  let contents = file.content
  if (!file.encoding || (file.encoding && file.encoding != 'utf-8')) {
    contents = atob(contents)
  }
  const bytes = new Uint8Array(contents.length)
  file.size = contents.length
  for (let i = 0; i < contents.length; i++) {
    bytes[i] = contents.charCodeAt(i)
  }
  const wrapObject = wrap('blob', bytes.buffer)
  const sha = sha1(wrapObject)
  if (file.sha) {
    if (file.sha !== sha) {
      Vue.set(file, 'newSha', sha)
    } else if (file.newSha) {
      Vue.delete(file, 'newSha')
    }
  } else {
    Vue.set(file, 'newSha', sha)
  }
  return sha
}

// function lengthInUtf8Bytes(str) {
//   const m = encodeURIComponent(str).match(/%[89ABab]/g)
//   return str.length + (m ? m.length : 0)
// }

// function shasum(buffer) {
//   return new Hash().update(buffer).digest('hex')
// }

function wrap(type, object) {
  return Buffer.concat([
    Buffer.from(`${type} ${object.byteLength.toString()}\x00`),
    Buffer.from(object)
  ])
}
