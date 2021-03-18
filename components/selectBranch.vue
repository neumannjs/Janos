<template>
  <div>
    <v-select
      v-model="selectedBranch"
      :items="branches.map(branch => branch.name)"
      prepend-icon="mdi-source-branch"
      menu-props="auto"
      hide-details
      single-line
      dense
    ></v-select>
    <commit ref="commit" />
  </div>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import InputDialog from '../components/inputDialog'
const debug = require('debug')('components/selectBranch')

export default {
  name: 'SelectBranch',
  components: {
    commit: InputDialog
  },
  computed: {
    ...mapGetters('github', ['numberOfChangedFiles']),
    ...mapState('github', ['currentBranch', 'branches']),
    selectedBranch: {
      get() {
        return this.$store.state.github.selectedBranch
      },
      set(value) {
        debug('change branch selection to %s.', value)
        if (this.numberOfChangedFiles > 0) {
          this.$refs.commit
            .open(
              'Unsaved changes',
              'Please commit your changes before switching branches',
              'Commit',
              'Cancel',
              'Commit message',
              'mdi-source-commit',
              false
            )
            .then(async commitMessage => {
              debug('commitMessage: %s', commitMessage)
              await this.createGitTree()
              await this.createGitCommit({ message: commitMessage })
              this.changeBranchSelection(value)
            })
            .catch(error => {
              debug('commit cancelled: %o', error)
              debug(
                'return to branch %s %s',
                this.$store.state.github.selectedBranch,
                value
              )
              // BUG: The dropdown still changes although the value does not.
            })
        } else {
          this.changeBranchSelection(value)
        }
      }
    }
  },
  methods: {
    ...mapActions('github', [
      'changeBranchSelection',
      'createGitTree',
      'createGitCommit'
    ])
  }
}
</script>
