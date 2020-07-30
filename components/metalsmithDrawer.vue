<template>
  <v-navigation-drawer
    v-show="activeDrawer == drawerName"
    v-model="drawer"
    :style="{marginLeft: '56px'}"
    width="300px"
    app
  >
    <v-toolbar flat height="48px">
      <v-list>
        <v-list-item>
          <v-list-item-title class="title">Metalsmith</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-toolbar>
    <v-list nav>
      <v-list-group value="true">
        <template v-slot:activator>
          <v-list-item>
            <v-list-item-title>Run Metalsmith</v-list-item-title>
          </v-list-item>
        </template>
        <v-list-item :disabled="metalsmithDisabled || currentBranch === 'source'" @click="runMetalsmith()">
          <v-list-item-action>
            <v-icon>mdi-play</v-icon>
          </v-list-item-action>

          <v-list-item-content>
            <v-list-item-title>Run MetalSmith</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list-group>
      <v-list-group>
        <template v-slot:activator>
          <v-list-item>
            <v-list-item-title>Templates</v-list-item-title>
          </v-list-item>
        </template>
        <v-list-item>
          <v-list-item-content>
            <v-text-field
              v-model="searchTerm"
              v-debounce:500ms="searchTemplate"
              placeholder="Search templates on Github"
              hide-details="auto"
            />
          </v-list-item-content>
        </v-list-item>
        <v-list-item v-for="(result, i) in results" :key="i" @click="addSubTree(result.full_name)">
          <v-list-item-content>
            <v-row no-gutters>
              <v-col>
                <v-img
                  :src="result.thumbnail"
                  aspect-ratio="1"
                  class="mr-2"
                  max-width="100"
                  max-height="100"
                >
                  <template v-slot:placeholder>
                    <v-progress-circular indeterminate color="grey lighten-5"></v-progress-circular>
                  </template>
                </v-img>
              </v-col>
              <v-col class="grow">{{ result.name }}</v-col>
            </v-row>
          </v-list-item-content>
        </v-list-item>
      </v-list-group>
    </v-list>
  </v-navigation-drawer>
</template>

<script>
import { mapMutations, mapState, mapActions } from 'vuex'

export default {
  name: 'MetalsmithDrawer',
  props: {
    drawer: { type: Boolean, default: false }
  },
  data() {
    return {
      drawerName: 'metalsmith',
      drawerTitle: 'Metalsmith',
      drawerIcon: 'mdi-anvil',
      searchTerm: '',
      results: []
    }
  },
  computed: {
    ...mapState('navigation', ['activeDrawer']),
    ...mapState('metalsmith', ['metalsmithDisabled']),
    ...mapState('github', ['currentBranch'])
  },
  mounted() {
    this.addDrawer({
      name: this.drawerName,
      title: this.drawerTitle,
      icon: this.drawerIcon
    })
  },
  methods: {
    searchTemplate() {
      this.searchTemplates(this.searchTerm).then(
        results => (this.results = results)
      )
    },
    ...mapMutations('navigation', ['addDrawer']),
    ...mapActions('github', ['searchTemplates', 'addSubTree']),
    ...mapActions('metalsmith', ['runMetalsmith'])
  }
}
</script>
