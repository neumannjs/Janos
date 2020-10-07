import Vue from 'vue'
const debug = require('debug')('store/github')
const sha1 = require('js-sha1')
// const Hash = require('sha.js/sha1')
const { isBinary } = require('istextorbinary')
const { btoaUTF8 } = require('bestbase64utf8')

export const state = () => ({
  fileTree: [],
  sourceFileTree: [],
  repo: '',
  treeSha: '',
  newTreeSha: '',
  fileContents: [],
  neumannssgSites: [],
  branches: [],
  currentBranch: '',
  selectedBranch: ''
})

export const mutations = {
  setBranches(state, payload) {
    state.branches = payload
  },

  setCurrentBranch(state, payload) {
    state.currentBranch = payload
    state.selectedBranch = payload
  },
  setSelectedBranch(state, payload) {
    state.selectedBranch = payload
  },
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
  setBranchSha(state, payload) {
    const index = state.branches.findIndex(
      branch => branch.name === payload.name
    )
    Vue.set(state.branches, index, payload)
  },
  clearFileContents(state) {
    state.fileContents = []
  },
  addFile(state, payload) {
    const file = state.fileContents.find(f => f.path === payload.path)
    if (file === undefined) {
      const entry = findFileRecursive(state.fileTree, payload.path)
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
      const parentRef = findFileRecursive(state.fileTree, parent.path)
      if (parentRef.children) {
        parentRef.children.push(node)
      } else {
        parentRef.children = [node]
      }
    }
    if (state.currentBranch === 'source') {
      state.sourceFileTree = state.fileTree
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
    if (state.currentBranch === 'source') {
      state.sourceFileTree = state.fileTree
    }
  },
  updateFileContent(state, { content, path, builtFile }) {
    const file = state.fileContents.find(f => f.path === path)
    file.content = content
    if (builtFile) {
      file.builtFile = builtFile
    }
    const entry = findFileRecursive(state.fileTree, file.path)
    entry.sha = calculateSha1(file)
    calculateSha1(file)
    if (state.currentBranch === 'source') {
      state.sourceFileTree = state.fileTree
    }
  }
}

export const actions = {
  async getBranches({ state, rootState, commit }) {
    const result = await this.$octoKit.repos.listBranches({
      owner: rootState.auth.user.login,
      repo: state.repo
    })
    debug('Branches: %o', result)
    if (result.data) {
      commit(
        'setBranches',
        result.data.map(branch => {
          return { name: branch.name, sha: branch.commit.sha }
        })
      )
    }
  },

  changeBranchSelection({ dispatch, commit, state, getters }, selection) {
    commit('setSelectedBranch', selection)
    if (getters.numberOfChangedFiles > 0) {
      // A small timeout is needed to give the bounded UI time to pick up the rollback of the changed selection
      setTimeout(function () {
        debug(
          'change branch selection back to %s, because there are unsaved changes',
          state.currentBranch
        )
        commit('setSelectedBranch', state.currentBranch)
      }, 500)
    } else {
      dispatch('checkoutBranch', selection)
    }
  },

  async searchTemplates({ rootState, commit }, searchTerm) {
    const q = `${searchTerm}+topic:neumannssg-template`
    const result = await this.$octoKit.search.repos({ q })
    const templates = result.data.items.map(template => {
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
  async addSubTree({ dispatch, state, rootState }, fullName) {
    // Poor man's subtree command (it just copies files from one repo to another)
    const owner = fullName.split('/')[0]
    const repo = fullName.split('/')[1]
    // create subfolder in layouts folder
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
    const treeSha = resultCommits.data[0].commit.tree.sha
    debug('Get git tree for repo %s wit tree sha %s.', fullName, treeSha)
    const result = await this.$octoKit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: 1
    })
    result.data.tree
      .forEach(async object => {
        object.path = '_layouts/' + repo + '/' + object.path
        if (object.type === 'blob') {
          // get blob
          debug('Get blob for path %s with sha %s.', object.path, object.sha)
          const blob = await this.$octoKit.git.getBlob({
            owner,
            repo,
            file_sha: object.sha
          })
          // create blob
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
      })
      .then(() => {
        dispatch('createGitTree').then(() => {
          dispatch('createGitCommit', {
            message: 'Copied repo ' + fullName + ' into _layouts folder'
          })
        })
      })
  },
  async getRepo({ rootState, commit }) {
    const pagesDomain = rootState.auth.user.login.toLowerCase() + '.github.io'
    const pathName = window.location.pathname
    let repoName = pathName.substring(1, pathName.indexOf('/admin'))
    if (repoName === '/') {
      if (process.env.APP_ENV === 'development') {
        debug(
          'Development mode: Picking neumannssg repo from Github: %s',
          process.env.APP_TEMPLATE_REPO
        )
        repoName = process.env.APP_TEMPLATE_REPO
      } else {
        repoName = pagesDomain
      }
    }
    let q = `user:${rootState.auth.user.login}+topic:neumannssg`
    let result = await this.$octoKit.search.repos({ q })
    if (
      result.data.items &&
      result.data.items.some(repo => repo.name === repoName)
    ) {
      debug(
        'Repository name  %s based on location path %s is a neumannssg repository',
        repoName,
        window.location.pathname
      )
      commit('setRepo', repoName)
    }
    const neumannSsgSites = result.data.items.map(site => {
      let adminUrl = ''
      if (pagesDomain === site.name.toLowerCase()) {
        adminUrl = 'https://' + pagesDomain + '/admin'
      } else {
        adminUrl = 'https://' + pagesDomain + '/' + site.name + '/admin'
      }
      return {
        name: site.name,
        url: adminUrl,
        active: site.name === repoName,
        neumannssg: true
      }
    })
    q = `repo:${rootState.auth.user.login}/${pagesDomain}`
    try {
      result = await this.$octoKit.search.repos({ q })
      if (result.data.items) {
        neumannSsgSites.push({
          name: pagesDomain,
          url: 'https://' + pagesDomain,
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

    const response = await this.$octoKit.repos.createUsingTemplate({
      template_owner: process.env.APP_TEMPLATE_OWNER,
      template_repo: process.env.APP_TEMPLATE_REPO,
      name
    })
    debug(
      'Created new NeumannSsg repo from template %s/%s, respons: %o',
      process.env.APP_TEMPLATE_OWNER,
      process.env.APP_TEMPLATE_REPO,
      response
    )
    if (response.status === 201) {
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
      const responsePages = await this.$octoKit.repos.enablePagesSite({
        owner: rootState.auth.user.login,
        repo: name,
        source: {
          branch: 'master',
          path: '/'
        }
      })
      debug(
        'Enabling Github Pages for %s/%s response : %o',
        rootState.auth.user.login,
        name,
        responsePages
      )

      commit(
        'status/addOrUpdateStatusItem',
        [
          {
            name: 'github',
            text: 'new repo created',
            icon: 'mdi-github',
            button: false,
            progress: { indeterminate: false, value: 100 }
          },
          {
            name: 'github',
            text: 'idle',
            icon: 'mdi-github',
            button: false
          }
        ],
        { root: true }
      )
      const pagesDomain = rootState.auth.user.login.toLowerCase() + '.github.io'
      let repoUrl = 'https://' + pagesDomain + '/'
      if (pagesDomain !== name) {
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
      debug('getFileTree result.data.tree: %O', result.data.tree)
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

  async getTreeSha({ rootState, state, commit }, sha = 'master') {
    const result = await this.$octoKit.repos.listCommits({
      owner: rootState.auth.user.login,
      repo: state.repo,
      sha,
      per_page: 1
    })
    commit('setTreeSha', result.data[0].commit.tree.sha)
    return result.data[0].commit.tree.sha
  },

  async merge({ rootState, state, commit, dispatch }, { head, message }) {
    commit(
      'status/addOrUpdateStatusItem',
      {
        name: 'github',
        text: 'Merging',
        icon: 'mdi-github',
        button: false,
        progress: { indeterminate: true }
      },
      { root: true }
    )
    const baseParent = state.branches.find(
      branch => branch.name === state.currentBranch
    )
    const headParent = state.branches.find(branch => branch.name === head)

    const gitTree = []

    const mapRecursive = object => {
      // TODO: Find a way to traverse two arrays at the same time without findFileRecursive
      const currentFile = findFileRecursive(state.fileTree, object.path)
      if (
        (currentFile === undefined || currentFile.sha !== object.sha) &&
        object.type === 'blob'
      ) {
        gitTree.push({
          path: object.path,
          mode: object.mode,
          type: object.type,
          sha: object.sha
        })
      }
      object.children && object.children.forEach(mapRecursive)
    }
    state.sourceFileTree.forEach(mapRecursive)

    if (gitTree.length > 0) {
      debug('Tree to be created: %o', gitTree)

      const result = await this.$octoKit.git.createTree({
        owner: rootState.auth.user.login,
        repo: state.repo,
        tree: gitTree,
        base_tree: state.treeSha
      })

      debug('Tree created. Github response: %o', result)

      const newTreeSha = result.data.sha

      const payload = {
        owner: rootState.auth.user.login,
        repo: state.repo,
        tree: newTreeSha,
        parents: [baseParent.sha, headParent.sha]
      }
      debug('merging payload %o', payload)
      if (message) {
        payload.message = message
      } else {
        payload.message = `Merge ${head} into ${state.currentBranch}`
      }
      try {
        const resultCommit = await this.$octoKit.git.createCommit(payload)
        debug('Github merge returned %o', result.data)

        debug('Merge response %O', result)
        if (resultCommit.data) {
          await this.$octoKit.git.updateRef({
            owner: rootState.auth.user.login,
            repo: state.repo,
            ref: 'heads/' + state.currentBranch,
            sha: resultCommit.data.sha
          })
          commit('setTreeSha', newTreeSha)
          commit('setBranchSha', {
            name: state.currentBranch,
            sha: resultCommit.data.sha
          })
          const indexSourceSrc = state.sourceFileTree.findIndex(
            object => object.path === '_src'
          )
          const indexSourceLayouts = state.sourceFileTree.findIndex(
            object => object.path === '_layouts'
          )
          const indexCurrentSrc = state.fileTree.findIndex(
            object => object.path === '_src'
          )
          const indexCurrentLayouts = state.fileTree.findIndex(
            object => object.path === '_layouts'
          )
          debug(
            'Replace _src in branch %s: %o with _src from source: %o ',
            state.currentBranch,
            state.fileTree[indexCurrentSrc],
            state.sourceFileTree[indexSourceSrc]
          )
          Vue.set(
            state.fileTree,
            indexCurrentSrc,
            state.sourceFileTree[indexSourceSrc]
          )
          debug(
            'Replace _layouts in branch %s: %o with _src from source: %o ',
            state.currentBranch,
            state.fileTree[indexCurrentLayouts],
            state.sourceFileTree[indexSourceLayouts]
          )
          Vue.set(
            state.fileTree,
            indexCurrentLayouts,
            state.sourceFileTree[indexSourceLayouts]
          )
        } else {
          return null
        }
        commit(
          'status/addOrUpdateStatusItem',
          [
            {
              name: 'github',
              text: 'merged',
              icon: 'mdi-github',
              button: false,
              progress: { indeterminate: false, value: 100 }
            },
            {
              name: 'github',
              text: 'idle',
              icon: 'mdi-github',
              button: false
            }
          ],
          { root: true }
        )
      } catch (error) {
        debug('Github merge returned error: %o', error)
        dispatch(
          'status/addNotification',
          {
            title: 'Merge returned an error',
            subTitle: `error: ${error}`
          },
          { root: true }
        )
        commit(
          'status/addOrUpdateStatusItem',
          [
            {
              name: 'github',
              text: 'merge error',
              icon: 'mdi-github',
              button: false,
              progress: { indeterminate: false, value: 100 }
            },
            {
              name: 'github',
              text: 'idle',
              icon: 'mdi-github',
              button: false
            }
          ],
          { root: true }
        )
      }
    }
  },

  async checkoutBranch({ state, dispatch, commit, getters }, branch) {
    if (getters.numberOfChangedFiles === 0) {
      commit('setFileTree', [])
      debug('old treeSha of branch %s: %s', state.currentBranch, state.treeSha)
      commit('setTreeSha', '')
      commit('setNewTreeSha', '')
      commit('clearFileContents')
      await dispatch('getTreeSha', branch)
      debug('new treeSha of branch %s: %s', branch, state.treeSha)
      await dispatch('getFileTree')
      if (branch === 'source') {
        state.sourceFileTree = state.fileTree
      }
      commit('setCurrentBranch', branch)
      commit('setSelectedBranch', branch)
    }
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
    /* eslint-disable no-async-promise-executor */
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
          content,
          ...fileNode
        }
        if (!contentIsBinary) {
          file.encoding = 'utf-8'
        }
        commit('addFile', file)
      }
      resolve(file)
    })
    /* eslint-enable no-async-promise-executor */
  },

  async getFile({ rootState, state, commit }, path) {
    debug('getFile will try to find file with path %s.', path)
    if (path[0] === '/') {
      path = path.substr(1)
    }
    let file = state.fileContents.find(f => f.path === path)
    if (file === undefined) {
      try {
        const treeFile = findFileRecursive(state.fileTree, path)
        if (treeFile !== undefined) {
          // fileTree only contains files that are in the github repository, or that are manually created in the browser
          debug('get file %s from github.', path)
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

    const createBlobs = state.fileContents
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
            if (editedFile.newSha !== result.data.sha) {
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

    const gitTree = state.fileContents
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
    const parent = state.branches.find(
      branch => branch.name === state.currentBranch
    )
    let result = await this.$octoKit.git.createCommit({
      owner: rootState.auth.user.login,
      repo: state.repo,
      message,
      tree: state.newTreeSha,
      parents: [parent.sha]
    })
    debug(
      'New commit created for repo %s/%s with sha %s',
      rootState.auth.user.login,
      state.repo,
      result.data.sha
    )
    commit('setTreeSha', state.newTreeSha)
    commit('setBranchSha', {
      name: state.currentBranch,
      sha: result.data.sha
    })
    commit('setNewTreeSha', '')
    debug('Updated treeSha with value of newTreeSha: %s', state.treeSha)
    result = await this.$octoKit.git.updateRef({
      owner: rootState.auth.user.login,
      repo: state.repo,
      ref: 'heads/' + state.currentBranch,
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
    setTimeout(function () {
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
  if (!path.includes('/')) {
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
  const contents = file.content
  let bytes
  if (!file.encoding || (file.encoding && file.encoding !== 'utf-8')) {
    bytes = Uint8Array.from(atob(contents), c => c.charCodeAt(0))
  } else {
    const enc = new TextEncoder()
    bytes = enc.encode(contents)
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
