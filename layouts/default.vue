<template>
  <v-app v-resize="onResize">
    <!-- Navigation drawers -->
    <!-- Activity bar -->
    <v-navigation-drawer
      ref="activityBar"
      permanent
      mini-variant
      :style="{ zIndex: '10' }"
      value="true"
      app
    >
      <v-list nav>
        <v-list-item v-for="(drw, i) in drawers" :key="i" @click="switchNav(drw.name)">
          <v-list-item-icon>
            <v-icon medium v-text="drw.icon" />
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title v-text="drw.title" />
          </v-list-item-content>
        </v-list-item>
        <v-list-item @click="switchNav('explorer')">
          <v-list-item-icon>
            <v-icon medium>mdi-file-multiple</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>Explorer</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item @click="switchNav('github')">
          <v-list-item-icon>
            <v-icon medium>mdi-github</v-icon>
          </v-list-item-icon>
          <v-list-item-content>
            <v-list-item-title>GitHub</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Navigation drawers that are activated by the Activity bar -->

    <!-- Repository explorer -->
    <v-navigation-drawer
      v-show="activeDrawer == 'explorer'"
      v-model="drawer"
      :style="{marginLeft: '56px'}"
      width="300px"
      app
    >
      <v-toolbar flat height="48px">
        <v-list>
          <v-list-item>
            <v-list-item-title class="title">Explorer</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-toolbar>
      <v-list nav>
        <v-list-group value="true">
          <template v-slot:activator>
            <v-list-item>
              <v-list-item-title>Repository</v-list-item-title>
            </v-list-item>
          </template>
          <v-list-item-content>
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
                <span>
                  <v-icon v-if="item.type === 'tree'">{{ open ? 'mdi-folder-open' : 'mdi-folder' }}</v-icon>
                  <v-icon
                    v-else-if="files[item.name.substring(item.name.indexOf('.') + 1)]"
                  >{{ files[item.name.substring(item.name.indexOf('.') + 1)].icon }}</v-icon>
                  <v-icon v-else>{{ files['default'].icon }}</v-icon>
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
                <span v-else>
                  <v-hover v-slot:default="{ hover }">
                    <div :style="{height: '38px'}" class="d-flex align-center">
                      {{ item.name }}
                      <v-spacer />
                      <span v-if="hover && item.type === 'tree'">
                        <v-btn
                          text
                          icon
                          color="red"
                          @click.stop="uploadParent = item; uploadDialog = true"
                        >
                          <v-icon>mdi-file-upload</v-icon>
                        </v-btn>
                        <v-btn text icon color="red" small @click.stop="onClickAddFileBtn(item)">
                          <v-icon>mdi-file-plus</v-icon>
                        </v-btn>
                        <v-btn text icon color="red" @click.stop="onClickAddFolderBtn(item)">
                          <v-icon>mdi-folder-plus</v-icon>
                        </v-btn>
                      </span>
                    </div>
                  </v-hover>
                </span>
              </template>
            </v-treeview>
          </v-list-item-content>
        </v-list-group>
        <v-list-group value="true">
          <template v-slot:activator>
            <v-list-item>
              <v-list-item-title>Info</v-list-item-title>
            </v-list-item>
          </template>
          <v-list-item-content>
            {{ numberOfChangedFiles }}
            <br />
          </v-list-item-content>
        </v-list-group>
      </v-list>
      <upload
        v-model="uploadDialog"
        :parent="uploadParent"
        :title="'Upload files to ' + uploadParent.name"
        :persistent="false"
      />
    </v-navigation-drawer>

    <!-- Github -->
    <v-navigation-drawer
      v-show="activeDrawer == 'github'"
      v-model="drawer"
      :style="{marginLeft: '56px'}"
      width="300px"
      app
    >
      <v-toolbar flat height="48px">
        <v-list>
          <v-list-item>
            <v-list-item-title class="title">Github</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-toolbar>
      <v-list nav>
        <v-list-item>
          <v-list-item-content>
            <v-textarea
              v-model="commitMessage"
              :auto-grow="true"
              rows="1"
              placeholder="Commit message"
            />
          </v-list-item-content>
        </v-list-item>
        <v-list-item :disabled="commitMessage == '' || commitDisable" @click="createCommit">
          <v-list-item-action>
            <v-icon>mdi-source-commit</v-icon>
          </v-list-item-action>

          <v-list-item-content>
            <v-list-item-title>Create Git Commit</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Metalsmith Drawer -->
    <metalsmith-drawer :drawer="drawer" />

    <!-- Tabs -->
    <v-app-bar ref="tabBar" flat dense app :style="{ paddingLeft: leftPadding + 'px' }">
      <v-tabs v-show="openTab" v-model="openTab" slider-color="white">
        <v-tab
          v-for="file in openFiles"
          :key="file.path"
          :href="`#${file.path}`"
          :ripple="false"
          @mouseover="hoverTab = file.path"
          @mouseout="hoverTab = null"
        >
          {{ file.name }}
          <v-btn text icon color="red" small :ripple="false" @click="closeTab(file.path)">
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
    </v-app-bar>

    <!-- Main content -->
    <v-content class="fill-height" :style="{ padding: '48px 0px 0px ' + leftPadding + 'px' }">
      <v-tabs-items v-model="openTab" class="fill-height">
        <v-tab-item
          v-for="file in openFiles"
          :key="file.path"
          :value="`${file.path}`"
          transition="false"
          reverse-transition="false"
          class="fill-height"
        >
          <v-container class="fill-height" fluid>
            <v-row no-gutters class="fill-height">
              <v-col ref="codeContainer" class="my-0">
                <v-card class="fill-height" width="100%" flat tile>
                  <codemirror
                    v-if="!file.binary"
                    :ref="`cmEditor-${file.path}`"
                    v-debounce:500ms="onCodeChange"
                    :value="file.content"
                    :options="cmOption"
                    @ready="onResize()"
                  />
                  <v-card v-else flat tile class="pa-2">The contents of this file are binary</v-card>
                </v-card>
              </v-col>
              <v-col
                v-show="splitEditor && buttons.preview"
                ref="previewWindow"
                cols="6"
                class="calculatedHeight"
              >
                <preview :path="file.builtFile" :style="{width: '100%', height: '100%'}" />
              </v-col>
            </v-row>
          </v-container>
        </v-tab-item>
      </v-tabs-items>
    </v-content>
    <!-- Footer -->
    <v-footer fixed app>
      <ftr />
    </v-footer>
  </v-app>
</template>

<script>
import { mapState, mapActions, mapMutations, mapGetters } from 'vuex'
import Preview from '../components/preview'
import Account from '../components/accountDialog'
import Upload from '../components/uploadDialog'
import MetalsmithDrawer from '../components/metalsmithDrawer'
import Footer from '../components/footer'
const debug = require('debug')('layouts/default')

export default {
  components: {
    preview: Preview,
    account: Account,
    upload: Upload,
    ftr: Footer,
    metalsmithDrawer: MetalsmithDrawer
  },
  data() {
    return {
      fileName: '',
      openTab: null,
      hoverTab: '',
      drawer: true,
      active: [],
      openFiles: [],
      open: [],
      splitEditor: false,
      leftPadding: 356,
      accountDialog: false,
      uploadDialog: false,
      uploadParent: { name: '' },
      commitMessage: '',
      commitDisable: false,
      files: {
        html: { icon: 'mdi-language-html5', mode: 'xml' },
        js: { icon: 'mdi-nodejs', mode: 'javascript' },
        json: { icon: 'mdi-code-json', mode: 'javascript' },
        md: {
          icon: 'mdi-language-markdown',
          mode: 'markdown',
          buttons: ['preview']
        },
        pdf: { icon: 'mdi-file-pdf', mode: '' },
        png: { icon: 'mdi-file-image', mode: '' },
        jpg: { icon: 'mdi-file-image', mode: '' },
        jpeg: { icon: 'mdi-file-image', mode: '' },
        txt: { icon: 'mdi-file-document-outline', mode: '' },
        xls: { icon: 'mdi-file-excel', mode: '' },
        njk: { icon: 'mdi-page-layout-body', mode: 'xml' },
        xml: { icon: 'mdi-xml', mode: 'xml' },
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
    devBuild: {
      get: function() {
        return this.$store.state.metalsmith.devBuild
      },
      set: function() {
        this.switchDevBuild()
      }
    },
    ...mapGetters('github', ['numberOfChangedFiles']),
    ...mapState('github', {
      items: state => state.fileTree
    }),
    ...mapState('navigation', ['drawers', 'activeDrawer'])
  },
  watch: {
    openTab: async function(val, oldVal) {
      // Whenever the open tab changes, change `active`, check whether buttons should be shown
      debug('openTab value changed from old: %s to new: %s', oldVal, val)
      if (val !== null) {
        // Retrieve file contents
        const file = this.openFiles[
          this.openFiles.findIndex(f => f.path === val)
        ]
        this.active = [file]
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
    active: async function(val, oldVal) {
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
          // open the file (if it is an existing file)
          const file = await this.getFile(val[0].path)
          this.openFiles.push({
            ...val[0],
            content: atob(file.content),
            builtFile: file.builtFile
          })
          this.openTab = val[0].path
        }
      }
    },
    numberOfChangedFiles: function() {
      this.addOrUpdateStatusItem({
        name: 'github',
        button: false,
        text:
          this.numberOfChangedFiles > 0
            ? this.numberOfChangedFiles + ' file(s) changed.'
            : 'idle',
        icon: 'mdi-github'
      })
    }
  },
  mounted: function() {
    this.setActiveDrawer('explorer')
    this.addOrUpdateStatusItem({
      name: 'github',
      button: false,
      text: 'idle',
      icon: 'mdi-github'
    })
    this.addOrUpdateStatusItem({
      name: 'metalsmith',
      button: false,
      text: 'idle',
      icon: 'mdi-anvil'
    })
  },
  methods: {
    createCommit: async function() {
      debug(this.commitMessage)
      this.commitDisable = true
      await this.createGitTree()
      await this.createGitCommit({ message: this.commitMessage })
      this.commitMessage = ''
      this.commitDisable = false
    },
    onResize: function() {
      if (window.innerWidth < 1264) {
        this.leftPadding = 56
      } else {
        this.leftPadding = this.drawer ? 356 : 56
      }
      let codeContainerWidth = window.innerWidth - this.leftPadding
      debug('onResize, containerWidth: ' + codeContainerWidth)
      debug('onResize, drawerWidth: ' + this.leftPadding)
      codeContainerWidth =
        this.splitEditor && this.buttons.preview
          ? codeContainerWidth / 2
          : codeContainerWidth
      this.openFiles.forEach(file => {
        debug('resize editor for %s', 'cmEditor-' + file.path)
        if (
          this.$refs['cmEditor-' + file.path] &&
          this.$refs['cmEditor-' + file.path][0]
        ) {
          this.$refs['cmEditor-' + file.path][0].codemirror.setSize(
            codeContainerWidth,
            null
          )
        }
      })
    },
    switchNav: function(drawer) {
      debug('switchNav %s', drawer)
      if (this.activeDrawer === drawer || this.drawer == false) {
        this.drawer = !this.drawer
        this.onResize()
      }
      this.setActiveDrawer(drawer)
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
    onCodeChange: function(value, event) {
      debug('code change of file %s', this.openTab)
      this.updateFileContent({
        content: this.$btoaUTF8(
          this.$refs['cmEditor-' + this.openTab][0].codemirror.doc.getValue()
        ),
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
    ...mapMutations('metalsmith', ['switchDevBuild']),
    ...mapMutations('navigation', ['setActiveDrawer']),
    ...mapMutations('status', ['addOrUpdateStatusItem'])
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
  height: calc(100% - 88px) !important;
}

.calculatedHeight {
  height: calc(100% - 40px) !important;
}
html {
  overflow-y: auto !important;
}
</style>
