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
        <v-list-item
          v-for="(drw, i) in drawers"
          :key="i"
          @click="switchNav(drw.name)"
        >
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
      :permanent="drawerPermanent"
      :style="{ marginLeft: '56px' }"
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
            <select-branch />
          </v-list-item-content>
          <v-list-item-content>
            <v-treeview
              :open.sync="open"
              :active.sync="active"
              :items="items"
              activatable
              hoverable
              item-key="path"
              open-on-click
              return-object
            >
              <template v-slot:prepend="{ item, open }">
                <span>
                  <v-icon v-if="item.type === 'tree'">{{
                    open ? 'mdi-folder-open' : 'mdi-folder'
                  }}</v-icon>
                  <v-icon
                    v-else-if="
                      files[item.name.substring(item.name.indexOf('.') + 1)]
                    "
                    >{{
                      files[item.name.substring(item.name.indexOf('.') + 1)]
                        .icon
                    }}</v-icon
                  >
                  <v-icon v-else>{{ files['default'].icon }}</v-icon>
                </span>
              </template>
              <template v-slot:label="{ item }">
                <span
                  v-if="item.type === 'newfile' || item.type === 'newfolder'"
                >
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
                  <v-tooltip bottom open-delay="500">
                    <template v-slot:activator="{ on, attrs }">
                      <div
                        v-bind="attrs"
                        :style="{ height: '38px' }"
                        class="d-flex align-center"
                        v-on="on"
                      >
                        <del v-if="item.deleted">{{ item.name }}</del>
                        <span v-else>{{ item.name }}</span>
                      </div>
                    </template>
                    <span>{{ item.name }}</span>
                  </v-tooltip>
                </span>
              </template>
              <template v-slot:append="{ item }">
                <span v-if="item.type === 'tree'">
                  <v-btn
                    text
                    icon
                    color="red"
                    @click.stop="
                      uploadParent = item
                      uploadDialog = true
                    "
                  >
                    <v-icon>mdi-upload</v-icon>
                  </v-btn>
                  <v-btn
                    text
                    icon
                    color="red"
                    small
                    @click.stop="onClickAddFileBtn(item)"
                  >
                    <v-icon>mdi-file-plus</v-icon>
                  </v-btn>
                  <v-btn
                    text
                    icon
                    color="red"
                    @click.stop="onClickAddFolderBtn(item)"
                  >
                    <v-icon>mdi-folder-plus</v-icon>
                  </v-btn>
                </span>
                <span v-else>
                  <v-btn
                    v-if="!item.deleted"
                    text
                    icon
                    color="red"
                    @click.stop="onClickDeleteFileBtn(item)"
                  >
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                  <v-btn
                    v-else
                    text
                    icon
                    color="red"
                    @click.stop="onClickRestoreFileBtn(item)"
                  >
                    <v-icon>mdi-file-restore</v-icon>
                  </v-btn>
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
            {{ treeSha }}
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
      :permanent="drawerPermanent"
      :style="{ marginLeft: '56px' }"
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
        <v-list-item
          :disabled="commitMessage == '' || commitDisable"
          @click="createCommit"
        >
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
    <metalsmith-drawer :drawer="drawer" :drawer-permanent="drawerPermanent" />

    <!-- Tabs -->
    <v-app-bar
      ref="tabBar"
      flat
      dense
      app
      :style="{ paddingLeft: leftPadding + 'px' }"
    >
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
          <v-btn
            text
            icon
            color="red"
            small
            :ripple="false"
            @click="closeTab(file.path)"
          >
            <v-icon v-show="hoverTab === file.path" small>close</v-icon>
          </v-btn>
        </v-tab>
      </v-tabs>
      <v-spacer />
      <v-toolbar-items>
        <v-btn
          v-show="buttons.preview"
          icon
          @click="
            splitEditor = !splitEditor
            onResize()
          "
        >
          <v-icon>pageview</v-icon>
        </v-btn>
        <account :model="accountDialog" />
      </v-toolbar-items>
    </v-app-bar>

    <!-- Main content -->
    <v-content
      class="fill-height"
      :style="{ padding: '48px 0px 0px ' + leftPadding + 'px' }"
    >
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
                    :value="file.content"
                    :options="cmOption"
                    @ready="onResize"
                    @paste="onPaste"
                    @change="onCodeChange"
                  />
                  <v-card v-else flat tile class="pa-2"
                    >The contents of this file are binary</v-card
                  >
                </v-card>
              </v-col>
              <v-col
                v-show="splitEditor && buttons.preview"
                ref="previewWindow"
                cols="6"
                class="calculatedHeight"
              >
                <preview
                  :file="getPreviewFile(file)"
                  :style="{ width: '100%', height: '100%' }"
                />
              </v-col>
            </v-row>
          </v-container>
        </v-tab-item>
      </v-tabs-items>
      <input-filename ref="input" />
    </v-content>
    <!-- Footer -->
    <v-footer fixed app class="footer">
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
import SelectBranch from '../components/selectBranch'
import InputDialog from '../components/inputDialog'
import { findOrCreateParent, right } from './../utils/utils'
import { uploadAndResizeFile } from './../utils/upload_file'
const debug = require('debug')('layouts/default')

export default {
  components: {
    preview: Preview,
    account: Account,
    upload: Upload,
    ftr: Footer,
    metalsmithDrawer: MetalsmithDrawer,
    selectBranch: SelectBranch,
    inputFilename: InputDialog
  },
  data() {
    return {
      fileName: '',
      openTab: null,
      hoverTab: '',
      drawer: true,
      drawerPermanent: true,
      active: [],
      open: [],
      splitEditor: false,
      leftPadding: 356,
      accountDialog: false,
      uploadDialog: false,
      uploadParent: { name: '' },
      commitMessage: '',
      commitDisable: false,
      files: {
        html: { icon: 'mdi-language-html5', mode: 'xml', buttons: ['preview'] },
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
      },
      branches: ['source', 'development', 'staging', 'master']
    }
  },
  computed: {
    ...mapGetters('github', [
      'numberOfChangedFiles',
      'openFiles',
      'metalsmithConfigObject'
    ]),
    ...mapState('github', {
      items: state => {
        // add root folder
        const rootFolder = [
          {
            children: state.fileTree,
            mode: '040000',
            name: state.repo,
            type: 'tree'
          }
        ]
        return rootFolder
      }
    }),
    ...mapState('github', ['fileContents', 'treeSha']),
    ...mapState('navigation', ['drawers', 'activeDrawer'])
  },
  watch: {
    openTab(val, oldVal) {
      // Whenever the open tab changes, change `active`, check whether buttons should be shown
      debug('openTab value changed from old: %s to new: %s', oldVal, val)
      if (val !== null) {
        // Retrieve file contents
        const file = this.fileContents.find(f => f.path === val)
        if (this.active.path !== file.path) {
          this.active = [file]
        }
        // Check for a file extension
        const extension = file.name.substring(file.name.lastIndexOf('.') + 1)
        if (this.files[extension]) {
          // Change the mode of the code editor to match the file extension
          this.cmOption.mode = this.files[extension].mode
          // Show and hide buttons based on the file extension
          for (const [key] of Object.entries(this.buttons)) {
            if (this.files[extension].buttons) {
              this.buttons[key] = this.files[extension].buttons.includes(key)
            } else {
              this.buttons[key] = false
            }
          }
        } else {
          // Default mode if file extension doesn't match
          this.cmOption.mode = this.files.default.mode
          for (const [key] of Object.entries(this.buttons)) {
            this.buttons[key] = false
          }
        }
      } else {
        for (const [key] of Object.entries(this.buttons)) {
          this.buttons[key] = false
        }
      }
      // Preview pane might be closed, so a resize might be necessary
      this.onResize()
    },
    async active(val, oldVal) {
      // Whenever the active item in the treeview changes, check whether a file
      // should be opened.
      debug('active value changed to: %o', val)
      if (
        (oldVal.length === 0 && !val[0].deleted) ||
        (val.length > 0 &&
          (oldVal.length === 0 || val[0].path !== oldVal[0].path) &&
          !val[0].deleted)
      ) {
        // Try to find the active item in fileContents, based on the path
        const file = this.fileContents.find(f => f.path === val[0].path)
        debug('Check for %s in fileContents yielded %o', val[0].path, file)
        if (file && file.opened) {
          debug('file already open, switch openTab to %s', val[0].path)
          // Make the tab of the already open file active
          this.openTab = val[0].path
        } else if (
          val[0].type !== 'newfile' &&
          val[0].type !== 'newfolder' &&
          val[0].type !== 'tree'
        ) {
          debug('file not open, getFile to %s', val[0].path)
          // open the file (if it is an existing file)
          const file = await this.getFile(val[0].path)
          this.setFileOpened({ file, value: true })
          this.openTab = val[0].path
        }
      }
    },
    numberOfChangedFiles() {
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
  mounted() {
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
    getPreviewFile(file) {
      const extension = file.name.substring(file.name.lastIndexOf('.') + 1)
      let path = ''
      if (extension !== 'html') {
        path = file.builtFile
      } else {
        path = file.path
      }
      let previewFile = this.fileContents.find(file => file.path === path)
      if (!previewFile || !previewFile.content) {
        previewFile = { content: '' }
      }
      return previewFile
    },
    async createCommit() {
      debug(this.commitMessage)
      this.commitDisable = true
      await this.createGitTree()
      await this.createGitCommit({ message: this.commitMessage })
      this.commitMessage = ''
      this.commitDisable = false
    },
    onPaste(cm, event) {
      debug('paste event')
      const kind = event.clipboardData.items[0].kind
      const image = event.clipboardData.items[0].type.includes('image')
      if (kind === 'file' && image) {
        const file = event.clipboardData.items[0].getAsFile()
        const date = new Date(Date.now())
        const proposedFilename =
          date.getFullYear().toString() +
          right('0' + (date.getMonth() + 1).toString(), 2) +
          right('0' + date.getDate().toString(), 2) +
          right('0' + date.getHours().toString(), 2) +
          right('0' + date.getMinutes().toString(), 2) +
          right('0' + date.getSeconds().toString(), 2) +
          '.png'
        this.$refs.input
          .open(
            'Upload image',
            '',
            'Upload',
            'Cancel',
            'File name',
            'create',
            false,
            proposedFilename
          )
          .then(filename => {
            const imgLoc = '_src/images/' + filename
            const parent = findOrCreateParent(this.items, imgLoc)
            const callback = newFile => {
              this.uploadFileContent({
                content: newFile.content,
                path: newFile.path
              })
            }
            uploadAndResizeFile(
              file,
              parent,
              this.metalsmithConfigObject['image-processing'],
              callback,
              filename,
              window.devicePixelRatio
            )
            cm.replaceRange(
              '![Alt text](/images/' + filename + ' "a title")',
              cm.getCursor()
            )
          })
          .catch(error => {
            debug('image paste cancelled: %o', error)
          })
      }
    },
    onResize() {
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
      this.fileContents.forEach(file => {
        debug('resize editor for %s', 'cmEditor-' + file.path)
        if (
          file.opened &&
          this.$refs['cmEditor-' + file.path] &&
          this.$refs['cmEditor-' + file.path][0]
        ) {
          this.$refs['cmEditor-' + file.path][0].codemirror.setSize(
            codeContainerWidth,
            null
          )
          this.$refs['cmEditor-' + file.path][0].codemirror.scrollIntoView(
            null,
            24
          )
        }
      })
    },
    switchNav(drawer) {
      debug('switchNav %s', drawer)
      if (this.activeDrawer === drawer || this.drawer === false) {
        this.drawer = !this.drawer
        this.drawerPermanent = this.drawer
        this.onResize()
      }
      this.setActiveDrawer(drawer)
    },

    closeTab(path) {
      debug('close tab %s', path)
      let lastPath = null
      let countdown = this.fileContents.length
      this.fileContents.forEach(file => {
        debug('check file %s to close with path %s.', file.path, path)
        if (file.path === path) {
          debug('close file %s', path)
          this.setFileOpened({ file, value: false })
          countdown = 1
        }
        if (file.opened && countdown > 0) {
          lastPath = file.path
          countdown -= 1
        }
      })
      debug('change openTab to %s', lastPath)
      this.openTab = lastPath
      this.active =
        lastPath === null
          ? []
          : [this.fileContents.find(file => file.path === lastPath)]
      debug('active tree item %o', this.active)
    },
    onClickAddFileBtn(item) {
      this.addNodeToTree({ parent: item, name: '', type: 'blob' }).then(
        newFile => {
          if (!this.open.includes(item)) {
            const self = this
            setTimeout(function () {
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
    onClickAddFolderBtn(item) {
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
    onClickDeleteFileBtn(item) {
      const file = this.fileContents.find(f => f.path === item.path)
      if (file && file.opened) {
        this.closeTab(file.path)
      }
      this.deleteFile(item)
    },
    onClickRestoreFileBtn(item) {
      this.restoreFile(item)
    },
    onBlurFileInput(item, fileName) {
      if (fileName.length > 0) {
        this.renameNode({ item, fileName }).then(path => {
          if (item.type !== 'tree') {
            this.addEmptyFile(item).then(() => {
              this.openTab = path
            })
          }
        })
        this.fileName = ''
      } else {
        this.removeFileFromTree(item)
      }
    },
    onCodeChange(value, event) {
      debug('code change of file %s', this.openTab)
      this.updateFileContent({
        content: this.$refs[
          'cmEditor-' + this.openTab
        ][0].codemirror.doc.getValue(),
        path: this.openTab
      })
    },
    ...mapActions('github', [
      'addNodeToTree',
      'getFile',
      'removeFileFromTree',
      'deleteFile',
      'restoreFile',
      'addEmptyFile',
      'renameNode',
      'createGitTree',
      'createGitCommit',
      'checkoutBranch'
    ]),
    ...mapActions('github', {
      uploadFileContent: 'updateFileContent'
    }),
    ...mapMutations('github', ['updateFileContent', 'setFileOpened']),
    ...mapActions('metalsmith', ['runMetalsmith']),
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

.footer {
  max-height: 40px;
  overflow-y: auto;
}
html {
  overflow-y: auto !important;
}

.v-treeview-node {
  max-width: 267px;
  white-space: nowrap;
  overflow: hidden;
  /*TODO: text-overflow doesn't work, find out why */
  text-overflow: ellipsis;
}

.v-treeview-node__append {
  width: 0px;
  visibility: hidden;
}

.v-treeview-node__root:hover .v-treeview-node__append {
  width: auto;
  visibility: visible;
}
</style>
