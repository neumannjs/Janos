<template>
  <div>
    <v-select
      v-model="selectedBranch"
      :items="branches"
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
import Commit from '../components/commitDialog'
const debug = require('debug')('components/selectBranch')

export default {
  name: 'SelectBranch',
  components: {
    commit: Commit
  },
  data() {
    return { branches: ['source', 'development', 'staging', 'master'] }
  },

  computed: {
    ...mapGetters('github', ['numberOfChangedFiles']),
    ...mapState('github', ['currentBranch']),
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
              'Please commit your changes before you switch branches'
            )
            .then(async commitMessage => {
              debug('commitMessage: %s', commitMessage)
              if (commitMessage !== null) {
                await this.createGitTree()
                await this.createGitCommit({ message: commitMessage })
                this.changeBranchSelection(value)
              } else {
                this.changeBranchSelection(value)
              }
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
