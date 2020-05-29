<template>
  <v-app v-resize="onResize">
    <!-- Navigation drawers -->
    <!-- Activity bar -->
    <v-navigation-drawer
      ref="activityBar"
      stateless
      permanent
      mini-variant
      :style="{ zIndex: '10' }"
      value="true"
      app
    >
      <v-list>
        <v-list-tile @click="switchNav('explorer')">
          <v-list-tile-action>
            <v-icon medium>mdi-file-multiple</v-icon>
          </v-list-tile-action>
        </v-list-tile>
        <v-list-tile @click="switchNav('github')">
          <v-list-tile-action>
            <v-icon medium>mdi-github</v-icon>
          </v-list-tile-action>
        </v-list-tile>
      </v-list>
    </v-navigation-drawer>

    <!-- Navigation drawer container -->
    <!-- Inside are the navigation drawers that are activated by the Activity bar -->
    <v-navigation-drawer
      ref="navDrawer"
      v-model="drawer"
      :mini-variant="!drawer"
      floating
      :style="{transform: 'translateX(0px)'}"
      app
      width="380"
    >
      <v-row class="fill-height">
        <v-spacer />
        <!-- Repository explorer -->
        <v-navigation-drawer v-show="activeNavbar == 'explorer'" v-model="drawer">
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
                      <v-icon
                        v-if="item.type === 'tree'"
                      >{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
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
                  <template v-slot:append="{ item }">
                    <span @mouseover="hoverTreeItem = item.path" @mouseout="hoverTreeItem = null">
                      <v-btn flat icon color="red" small @click.stop="onClickUploadFileBtn(item)">
                        <v-icon
                          v-show="item.type === 'tree' && hoverTreeItem === item.path"
                        >mdi-file-upload</v-icon>
                      </v-btn>
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
                preview path: {{ previewPath }}
                <br />
              </v-list-tile-content>
            </v-list-group>
          </v-list>
        </v-navigation-drawer>

        <!-- Github -->
        <v-navigation-drawer v-show="activeNavbar == 'github'" v-model="drawer">
          <v-toolbar flat height="48px">
            <v-list>
              <v-list-tile>
                <v-list-tile-title class="title">Github</v-list-tile-title>
              </v-list-tile>
            </v-list>
          </v-toolbar>
          <v-list>
            <v-list-tile>
              <v-list-tile-content>
                <v-switch
                  v-model="devBuild"
                  :label="devBuild ? 'development' : 'production'"
                  height="42"
                />
              </v-list-tile-content>
            </v-list-tile>
            <v-list-tile @click="runMetalsmith()">
              <v-list-tile-action>
                <v-icon>mdi-anvil</v-icon>
              </v-list-tile-action>

              <v-list-tile-content>
                <v-list-tile-title>Run MetalSmith</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
            <v-list-tile @click="createGitTree()">
              <v-list-tile-action>
                <v-icon>mdi-file-tree</v-icon>
              </v-list-tile-action>

              <v-list-tile-content>
                <v-list-tile-title>Create Git Tree</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
            <v-list-tile @click="createGitCommit()">
              <v-list-tile-action>
                <v-icon>mdi-source-commit</v-icon>
              </v-list-tile-action>

              <v-list-tile-content>
                <v-list-tile-title>Create Git Commit</v-list-tile-title>
              </v-list-tile-content>
            </v-list-tile>
          </v-list>
        </v-navigation-drawer>
      </v-row>
    </v-navigation-drawer>

    <!-- Tabs -->
    <v-toolbar ref="tabBar" flat app height="48px" :style="{ paddingLeft: leftPadding + 'px' }">
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
        <v-btn v-show="buttons.preview" icon @click="splitEditor = !splitEditor; onResize()">
          <v-icon>pageview</v-icon>
        </v-btn>
        <account :model="accountDialog" />
      </v-toolbar-items>
    </v-toolbar>

    <!-- Main content -->
    <v-content :style="{ padding: '48px 0px 32px ' + leftPadding + 'px' }">
      <v-container class="fill-height" fluid>
        <v-row>
          <v-col ref="codeContainer">
            <v-card height="100%" width="100%" flat tile>
              <codemirror
                v-show="openTab"
                ref="cmEditor"
                v-model="code"
                v-debounce:500ms="onCodeChange"
                :options="cmOption"
              />
            </v-card>
          </v-col>
          <v-col v-show="splitEditor && buttons.preview" ref="previewWindow" cols="6">
            <preview :path="previewPath" :style="{width: '100%', height: '100%'}" />
          </v-col>
        </v-row>
      </v-container>
    </v-content>
    <!-- Footer -->
    <v-footer fixed app :style="{ zIndex: '20' }">
      <ftr></ftr>
    </v-footer>
  </v-app>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex'
import Preview from '../components/preview'
import Account from '../components/accountDialog'
import Footer from '../components/footer'
const debug = require('debug')('layouts/default')

export default {
  components: {
    preview: Preview,
    account: Account,
    ftr: Footer
  },
  data() {
    return {
      fileName: '',
      previewPath: null,
      openTab: null,
      hoverTab: '',
      hoverTreeItem: '',
      drawer: true,
      active: [],
      openFiles: [],
      open: [],
      activeNavbar: 'explorer',
      splitEditor: false,
      leftPadding: 380,
      accountDialog: false,
      files: {
        html: { icon: 'mdi-language-html5', mode: 'xml' },
        js: { icon: 'mdi-nodejs', mode: 'javascript' },
        json: { icon: 'mdi-json', mode: 'javascript' },
        md: { icon: 'mdi-markdown', mode: 'markdown', buttons: ['preview'] },
        pdf: { icon: 'mdi-file-pdf', mode: '' },
        png: { icon: 'mdi-file-image', mode: '' },
        txt: { icon: 'mdi-file-document-outline', mode: '' },
        xls: { icon: 'mdi-file-excel', mode: '' },
        njk: { icon: 'mdi-page-layout-body', mode: 'xml' },
        css: { icon: 'mdi-language-css3', mode: 'css' },
        hbs: { icon: 'mdi-code-braces-box', mode: 'handlebars' },
        default: { icon: 'mdi-file', mode: '' }
      },
      buttons: {
        preview: false
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
        return this.$store.state.metalsmith.devBuild
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
        this.previewPath = file.builtFile ? file.builtFile : ''
        // Update the code shown in the code editor with the contents of the file
        this.code = atob(file.content)
        // Check for a file extension
        const extension = file.name.substring(file.name.lastIndexOf('.') + 1)
        if (this.files[extension]) {
          // Change the mode of the code editor to match the file extension
          this.cmOption.mode = this.files[extension].mode
          // Show and hide buttons based on the file extension
          for (let [key] of Object.entries(this.buttons)) {
            if (this.files[extension].buttons) {
              this.buttons[key] = this.files[extension].buttons.includes(key)
            } else {
              this.buttons[key] = false
            }
          }
        } else {
          // Default mode if file extension doesn't match
          this.cmOption.mode = this.files.default.mode
          for (let [key] of Object.entries(this.buttons)) {
            this.buttons[key] = false
          }
        }
      } else {
        for (let [key] of Object.entries(this.buttons)) {
          this.buttons[key] = false
        }
      }
      // Preview pane might be closed, so a resize might be necessary
      this.onResize()
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
      if (window.innerWidth < 1264) {
        this.leftPadding = 80
      } else {
        this.leftPadding = this.drawer ? 380 : 80
      }
      this.$refs.navDrawer.width = this.drawer
        ? this.$refs.navDrawer.width
        : this.$refs.activityBar.miniVariantWidth
      let drawerWidth =
        window.innerWidth < 1264 ? 80 : this.$refs.navDrawer.width
      let codeContainerWidth = window.innerWidth - drawerWidth
      debug('onResize, containerWidth: ' + codeContainerWidth)
      debug('onResize, drawerWidth: ' + drawerWidth)
      codeContainerWidth =
        this.splitEditor && this.buttons.preview
          ? codeContainerWidth / 2
          : codeContainerWidth
      this.codemirror.setSize(codeContainerWidth, null)
    },
    switchNav: function(navbar) {
      if (this.activeNavbar === navbar || this.drawer == false) {
        this.drawer = !this.drawer
      }
      this.activeNavbar = navbar
      this.onResize()
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
    ...mapActions('github', [
      'addNodeToTree',
      'getFile',
      'removeFileFromTree',
      'addEmptyFile',
      'renameNode',
      'createGitTree',
      'createGitCommit'
    ]),
    ...mapMutations('github', ['updateFileContent']),
    ...mapActions('metalsmith', ['runMetalsmith']),
    ...mapMutations('metalsmith', ['switchDevBuild'])
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
