import { Octokit } from '@octokit/rest'

export default ({ store, app: { $auth } }, inject) => {
  if (!$auth.loggedIn) {
    return
  }

  const octoKit = new Octokit({
    auth: $auth.getToken('githubProxy')
  })

  inject('octoKit', octoKit)

  store.dispatch('github/getRepo').then(() => {
    store.dispatch('github/getTreeSha', 'source').then(() => {
      store.dispatch('github/getFileTree')
    })
  })
}
