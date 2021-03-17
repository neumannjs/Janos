import Vue from 'vue'
import {
  findParentRecursive,
  findOrCreateParent,
  findFileRecursive,
  addTreeItem,
  calculateSha1,
  setFileSha
} from './../utils/utils'
const debug = require('debug')('store/github')
const { isBinary } = require('istextorbinary')
const { btoaUTF8 } = require('bestbase64utf8')

export const state = () => ({
  fileTree: [],
  sourceFileTree: [],
  repo: '',
  repoOwner: '',
  treeSha: '',
  newTreeSha: '',
  fileContents: [],
  janosSites: [],
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
  setJanosSites(state, payload) {
    state.janosSites = payload
  },
  setRepo(state, payload) {
    state.repo = payload
  },
  setRepoOwner(state, payload) {
    state.repoOwner = payload
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
  setFileDeleted(state, { file, value }) {
    if (value) {
      Vue.set(file, 'deleted', value)
    } else {
      Vue.delete(file, 'deleted')
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
      if (folder.length > 0) {
        folder += '/'
      }
      item.name = fileName
      item.path = folder + fileName
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
    if (content !== null) {
      // if the file is not to be deleted
      file.content = content
      const entry = findFileRecursive(state.fileTree, file.path)
      const sha = calculateSha1(file)
      entry.sha = sha
    } else {
      // File is to be deleted. Only set sha to null, but leave content untouced
      // for possible restore
      setFileSha(file, null)
    }

    if (builtFile) {
      file.builtFile = builtFile
    }

    if (state.currentBranch === 'source') {
      state.sourceFileTree = state.fileTree
    }
  }
}

export const actions = {
  async getBranches({ state, rootState, commit }) {
    const result = await this.$octoKit.repos.listBranches({
      owner: state.repoOwner,
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
    const q = `${searchTerm}+topic:janos-template`
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
            owner: state.repoOwner,
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
    const pagesDomain = window.location.hostname
    const pathName = window.location.pathname
    let repoName = pathName.substring(1, pathName.indexOf('/admin'))
    if (repoName === '/') {
      if (process.env.APP_ENV === 'development') {
        debug(
          'Development mode: Picking Janos repo from Github: %s',
          process.env.APP_TEMPLATE_REPO
        )
        repoName = process.env.APP_TEMPLATE_REPO
      } else {
        repoName = pagesDomain
      }
    }
    let result = await this.$octoKit.repos.listForAuthenticatedUser({
      per_page: 100,
      mediaType: {
        previews: ['mercy']
      }
    })
    // TODO: Built filter that iterates through result pages. Now it ignores repos above 100.
    result = result.data.filter(repo => {
      if (repo.topics) {
        return repo.topics.some(topic => topic === 'janos')
      }
      return false
    })
    if (
      result &&
      result.some(
        repo =>
          repo.name === repoName ||
          repo.homepage.replace(/https?:\/\//g, '') === repoName
      )
    ) {
      debug(
        'Repository name  %s based on location path %s is a Janos repository',
        result.find(
          repo =>
            repo.name === repoName ||
            repo.homepage.replace(/https?:\/\//g, '') === repoName
        ).name,
        window.location.pathname
      )
      commit(
        'setRepo',
        result.find(
          repo =>
            repo.name === repoName ||
            repo.homepage.replace(/https?:\/\//g, '') === repoName
        ).name
      )
      commit(
        'setRepoOwner',
        result.find(
          repo =>
            repo.name === repoName ||
            repo.homepage.replace(/https?:\/\//g, '') === repoName
        ).owner.login
      )
    }
    const janosSites = result.map(site => {
      let adminUrl = ''
      if (
        pagesDomain === site.name.toLowerCase() ||
        pagesDomain === site.homepage.toLowerCase().replace(/https?:\/\//g, '')
      ) {
        adminUrl = 'https://' + site.owner.login + '.github.io/admin'
      } else {
        adminUrl =
          'https://' + site.owner.login + '.github.io/' + site.name + '/admin'
      }
      return {
        name: site.name,
        url: adminUrl,
        active: site.name === repoName,
        janos: true
      }
    })
    const q = `repo:${rootState.auth.user.login}/${
      rootState.auth.user.login.toLowerCase() + '.github.io'
    }`
    try {
      result = await this.$octoKit.search.repos({ q })
      if (result.data.items) {
        janosSites.push({
          name: rootState.auth.user.login.toLowerCase() + '.github.io',
          url:
            'https://' + rootState.auth.user.login.toLowerCase() + '.github.io',
          active: false,
          janos: false
        })
      }
      debug('Search for personal Github Pages returned: %o', result)
    } catch (error) {
      debug('Search for personal Github Pages returned error: %o', error)
    }
    commit('setJanosSites', janosSites)
    return repoName
  },

  async createRepo({ rootState, commit, dispatch }, name) {
    // TODO: Support creating repos in Organizations the user is a member of.
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
      name,
      include_all_branches: true
    })
    debug(
      'Created new Janos repo from template %s/%s, respons: %o',
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
      // repo is created, now add topic (to be able to distinguish janos repo's later on)
      const responseTopics = await this.$octoKit.repos.replaceAllTopics({
        owner: rootState.auth.user.login,
        repo: name,
        names: ['janos']
      })
      debug(
        'Add topic janos to repo %s/%s : %o',
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

  async getFileTree({ state, commit }, { force } = { force: false }) {
    if (state.fileTree.length === 0 || force) {
      const result = await this.$octoKit.git.getTree({
        owner: state.repoOwner,
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
      owner: state.repoOwner,
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
        owner: state.repoOwner,
        repo: state.repo,
        tree: gitTree,
        base_tree: state.treeSha
      })

      debug('Tree created. Github response: %o', result)

      const newTreeSha = result.data.sha

      const payload = {
        owner: state.repoOwner,
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
            owner: state.repoOwner,
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

  async deleteFile({ commit, dispatch, state }, file) {
    const fileContent = await dispatch('getFile', file.path)
    if (fileContent !== undefined) {
      commit('updateFileContent', {
        content: null,
        path: file.path,
        builtFile: false
      })
      commit('setFileDeleted', { file, value: true })
    }
  },

  restoreFile({ commit, state }, file) {
    const fileContent = state.fileContents.find(f => f.path === file.path)
    const sha = calculateSha1(fileContent)
    setFileSha(fileContent, sha) // This should remove newSha
    commit('setFileDeleted', { file, value: false })
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
            owner: state.repoOwner,
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
        parent = parent.children
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
    commit('deleteFileFromTree', {
      parent,
      index: parent.findIndex(i => i.path === file.path)
    })
  },

  renameNode({ state, commit }, { item, fileName }) {
    return new Promise((resolve, reject) => {
      commit('renameNode', { item, fileName })
      resolve(item.path)
    })
  },

  async createGitTree({ state, commit, dispatch }) {
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

    // create new Blobs for files that have a truthy value in newSha (so deleted
    // files with newsha set to null will be ignored)
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
            owner: state.repoOwner,
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

    // Create a git tree for *all* files with a newSha property (regardless of
    // the value of the propery). This includes files that will be deleted,
    // having a newSha of null.
    const gitTree = state.fileContents
      .filter(file => Object.prototype.hasOwnProperty.call(file, 'newSha'))
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
      owner: state.repoOwner,
      repo: state.repo,
      tree: gitTree,
      base_tree: state.treeSha
    })

    debug('gitTree created: %o', result.data)

    commit('setNewTreeSha', result.data.sha)

    state.fileContents.forEach(file => {
      if (Object.prototype.hasOwnProperty.call(file, 'newSha')) {
        if (file.newSha === null) {
          dispatch('removeFileFromTree', file)
          state.fileContents.splice(
            state.fileContents.findIndex(f => f.path === file.path),
            1
          )
        } else {
          Vue.delete(file, 'newSha')
        }
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
      state.repoOwner,
      state.repo,
      state.newTreeSha
    )
    const parent = state.branches.find(
      branch => branch.name === state.currentBranch
    )
    let result = await this.$octoKit.git.createCommit({
      owner: state.repoOwner,
      repo: state.repo,
      message,
      tree: state.newTreeSha,
      parents: [parent.sha]
    })
    debug(
      'New commit created for repo %s/%s with sha %s',
      state.repoOwner,
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
      owner: state.repoOwner,
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
    return state.fileContents.filter(file =>
      Object.prototype.hasOwnProperty.call(file, 'newSha')
    ).length
  },
  openFiles: state => {
    return state.fileContents.filter(file => file.opened)
  }
}
