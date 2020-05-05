<template>
  <v-app v-resize="onResize" dark>
    <v-navigation-drawer ref="navDrawer" v-model="drawer" app>
      <v-toolbar flat height="48px">
        <v-list>
          <v-list-tile>
            <v-list-tile-title class="title">Explorer</v-list-tile-title>
          </v-list-tile>
        </v-list>
      </v-toolbar>
      <v-list>
        <v-list-group value="true">
          <template v-slot:activator>
            <v-list-tile>
              <v-list-tile-title>Repository</v-list-tile-title>
            </v-list-tile>
          </template>
          <v-list-tile-content>
            <v-treeview
              :open.sync="open"
              :active.sync="active"
              :items="items"
              activatable
              item-key="path"
              open-on-click
              return-object
            >
              <template v-slot:prepend="{ item, open }">
                <span @mouseover="hoverTreeItem = item.path" @mouseout="hoverTreeItem = null">
                  <v-icon v-if="item.type === 'tree'">{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
                  <v-icon
                    v-else-if="files[item.name.substring(item.name.indexOf('.') + 1)]"
                  >{{ files[item.name.substring(item.name.indexOf('.') + 1)].icon }}</v-icon>
                  <v-icon v-else>{{ files['default'] }}</v-icon>
                </span>
              </template>
              <template v-slot:label="{ item }">
                <span v-if="item.type === 'newfile' || item.type === 'newfolder'">
                  <v-text-field
                    v-model="fileName"
                    required
                    height="34px"
                    autofocus
                    @blur="onBlurFileInput(item, fileName)"
                    @keydown.enter="$event.target.blur()"
                  />
                </span>
                <span
                  v-else
                  @mouseover="hoverTreeItem = item.path"
                  @mouseout="hoverTreeItem = null"
                >{{ item.name }}</span>
              </template>
              <template v-slot:append="{ item, open }">
                <span @mouseover="hoverTreeItem = item.path" @mouseout="hoverTreeItem = null">
                  <v-btn flat icon color="red" small @click.stop="onClickAddFileBtn(item)">
                    <v-icon
                      v-show="item.type === 'tree' && hoverTreeItem === item.path"
                    >mdi-file-plus</v-icon>
                  </v-btn>
                  <v-btn flat icon color="red" small @click.stop="onClickAddFolderBtn(item)">
                    <v-icon
                      v-show="item.type === 'tree' && hoverTreeItem === item.path"
                    >mdi-folder-plus</v-icon>
                  </v-btn>
                </span>
              </template>
            </v-treeview>
          </v-list-tile-content>
        </v-list-group>
        <v-list-group value="true">
          <template v-slot:activator>
            <v-list-tile>
              <v-list-tile-title>Info</v-list-tile-title>
            </v-list-tile>
          </template>
          <v-list-tile-content>
            <!-- openTab: {{ openTab }}
            <br />
            fileName: {{ fileName }}
            <br />
            hoverTab: {{ hoverTab }}
            <br />
            hoverTreeItem: {{ hoverTreeItem }}
            <br />
            active: {{ active }}
            <br />
            openFiles: {{ openFiles }}
            <br />
            open: {{ open }}-->
          </v-list-tile-content>
        </v-list-group>
      </v-list>
    </v-navigation-drawer>
    <v-toolbar flat app height="48px">
      <v-toolbar-side-icon @click="drawer = !drawer; resize()" />
      <v-tabs v-show="openTab" v-model="openTab" color="transparent" slider-color="white">
        <v-tab
          v-for="file in openFiles"
          :key="file.path"
          :href="`#${file.path}`"
          :ripple="false"
          @mouseover="hoverTab = file.path"
          @mouseout="hoverTab = null"
        >
          {{ file.name }}
          <v-btn flat icon color="red" small :ripple="false" @click="closeTab(file.path)">
            <v-icon v-show="hoverTab === file.path" small>close</v-icon>
          </v-btn>
        </v-tab>
      </v-tabs>
      <v-spacer />
      <v-toolbar-items>
        <v-switch v-model="devBuild" :label="devBuild ? 'development' : 'production'" height="42" />
        <v-btn icon @click="runMetalsmith()">
          <v-icon>mdi-anvil</v-icon>
        </v-btn>
        <v-btn icon @click="createGitTree()">
          <v-icon>mdi-file-tree</v-icon>
        </v-btn>
        <v-btn icon @click="createGitCommit()">
          <v-icon>mdi-source-commit</v-icon>
        </v-btn>
        <v-btn icon @click="logout()">
          <v-icon>mdi-logout</v-icon>
        </v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <v-content>
      <v-container fluid fill-height>
        <v-layout>
          <v-flex ref="codeContainer" shrink>
            <codemirror
              v-show="openTab"
              ref="cmEditor"
              v-model="code"
              v-debounce:500ms="onCodeChange"
              :style="{ width: '500px' }"
              :options="cmOption"
            />
          </v-flex>
        </v-layout>
      </v-container>
    </v-content>
    <v-footer app>
      <span>&copy; 2019</span>
    </v-footer>
  </v-app>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex'

export default {
  data() {
    return {
      fileName: '',
      openTab: null,
      hoverTab: '',
      hoverTreeItem: '',
      clipped: false,
      drawer: false,
      active: [],
      openFiles: [],
      open: [],
      files: {
        html: { icon: 'mdi-language-html5', mode: 'xml' },
        js: { icon: 'mdi-nodejs', mode: 'javascript' },
        json: { icon: 'mdi-json', mode: 'javascript' },
        md: { icon: 'mdi-markdown', mode: 'markdown' },
        pdf: { icon: 'mdi-file-pdf', mode: '' },
        png: { icon: 'mdi-file-image', mode: '' },
        txt: { icon: 'mdi-file-document-outline', mode: '' },
        xls: { icon: 'mdi-file-excel', mode: '' },
        njk: { icon: 'mdi-page-layout-body', mode: 'xml' },
        css: { icon: 'mdi-language-css3', mode: 'css' },
        default: { icon: 'mdi-file', mode: '' }
      },
      code: '',
      cmOption: {
        tabSize: 2,
        foldGutter: true,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        mode: '',
        theme: 'monokai',
        gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
        keymap: 'sublime',
        lineWrapping: true,
        scrollbarStyle: 'native'
      }
    }
  },
  computed: {
    ...mapState('github', {
      items: state => state.fileTree
    }),
    devBuild: {
      get: function() {
        return this.$store.state.github.devBuild
      },
      set: function() {
        this.switchDevBuild()
      }
    },
    codemirror: function() {
      return this.$refs.cmEditor.codemirror
    }
  },
  watch: {
    openTab: async function(val, oldVal) {
      // Whenever the open tab changes, retreive the file contents and show it in the code editor.
      if (val !== null) {
        // Retrieve file contents
        const file = await this.getFile(val)
        this.active = [file]
        // Update the code shown in the code editor with the contents of the file
        this.code = atob(file.content)
        // Check for a file extension
        const extension = file.name.substring(file.name.lastIndexOf('.') + 1)
        if (this.files[extension]) {
          // Change the mode of the code editor to match the file extension
          this.cmOption.mode = this.files[extension].mode
        } else {
          // Default mode if file extension doesn't match
          this.cmOption.mode = this.files.default.mode
        }
      }
    },
    active: function(val, oldVal) {
      // Whenever the active item in the treeview changes, check whether a file
      // should be opened.
      if (val.length > 0) {
        // Try to find the active item in the openfiles, based on the path
        const index = this.openFiles.findIndex(f => f.path === val[0].path)
        if (index > -1) {
          // Make the tab of the already open file active
          this.openTab = val[0].path
        } else if (
          val[0].type !== 'newfile' &&
          val[0].type !== 'newfolder' &&
          val[0].type !== 'tree'
        ) {
          // open the filem (if it is an existing file)
          this.openTab = val[0].path
          this.openFiles.push({
            ...val[0]
          })
        }
      }
    }
  },
  mounted: function() {
    this.onResize()
  },
  methods: {
    onResize: function() {
      console.log(this.$refs.navDrawer)
      let drawerWidth = this.drawer ? this.$refs.navDrawer.width : 0
      if (window.innerWidth < this.$refs.navDrawer.mobileBreakPoint) {
        drawerWidth = 0
      }
      this.codemirror.setSize(window.innerWidth - drawerWidth, null)
    },
    closeTab: function(path) {
      this.active = []
      const indexFileToClose = this.openFiles.findIndex(f => f.path === path)
      const indexOpenTab = this.openFiles.findIndex(f => f.path === path)
      if (indexFileToClose > -1) {
        this.openFiles.splice(indexFileToClose, 1)
        if (this.openTab === path) {
          if (this.openFiles.length === 0) {
            this.openTab = null
            this.code = ''
          } else if (indexOpenTab === this.openFiles.length) {
            this.openTab = this.openFiles[indexOpenTab - 1].path
          } else {
            this.openTab = this.openFiles[indexOpenTab].path
          }
        }
      }
    },
    onClickAddFileBtn: function(item) {
      this.addNodeToTree({ parent: item, name: '', type: 'blob' }).then(
        newFile => {
          if (!this.open.includes(item)) {
            const self = this
            setTimeout(function() {
              self.open.push(item)
            }, 1000)
          }
          if (this.active.length === 0) {
            this.active.push(newFile)
          } else {
            this.$set(this.active, 0, newFile)
          }
        }
      )
    },
    onClickAddFolderBtn: function(item) {
      if (!this.open.includes(item)) {
        this.open.push(item)
      }
      this.addNodeToTree({ parent: item, name: '', type: 'tree' }).then(
        newFolder => {
          if (this.active.length === 0) {
            this.active.push(newFolder)
          } else {
            this.$set(this.active, 0, newFolder)
          }
        }
      )
    },
    onBlurFileInput: function(item, fileName) {
      if (fileName.length > 0) {
        this.renameNode({ item, fileName }).then(path => {
          if (item.type !== 'tree') {
            this.addEmptyFile(item).then(() => {
              this.openTab = path
              this.openFiles.push({
                ...item
              })
            })
          }
        })
        this.fileName = ''
      } else {
        this.removeFileFromTree(item)
      }
    },
    onCodeChange: function() {
      this.updateFileContent({
        content: this.$btoaUTF8(this.code),
        path: this.openTab
      })
    },
    logout: async function() {
      await this.$auth.logout()
    },
    ...mapActions('github', [
      'addNodeToTree',
      'getFile',
      'removeFileFromTree',
      'addEmptyFile',
      'renameNode',
      'createGitTree',
      'createGitCommit',
      'runMetalsmith',
      'getDevBuild'
    ]),
    ...mapMutations('github', ['updateFileContent', 'switchDevBuild'])
  }
}
</script>

<style>
.container {
  width: 100%;
  margin: 0 auto;
  padding: 0 !important;
  text-align: left;
}
.CodeMirror {
  position: fixed !important;
  height: calc(100% - 86px) !important;
}
html {
  overflow-y: auto;
}
</style>
