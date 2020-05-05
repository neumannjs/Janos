import Vue from 'vue'
import VueCodemirror from 'vue-codemirror'

// styles
import 'codemirror/lib/codemirror.css'
import 'codemirror/addon/merge/merge.css'
import 'codemirror/theme/monokai.css'

// language
import 'codemirror/mode/vue/vue'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/mode/markdown/markdown'
// import 'codemirror/mode/clike/clike.js'

// active-line.js
import 'codemirror/addon/selection/active-line.js'

// styleSelectedText
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/search/searchcursor.js'

//scrollbars
import 'codemirror/addon/scroll/simplescrollbars.js'

// highlightSelectionMatches
import 'codemirror/addon/scroll/annotatescrollbar.js'
import 'codemirror/addon/search/matchesonscrollbar.js'
import 'codemirror/addon/search/match-highlighter.js'
import 'codemirror/addon/edit/matchbrackets.js'

// keyMap
import 'codemirror/addon/comment/comment.js'
import 'codemirror/addon/dialog/dialog.js'
import 'codemirror/addon/dialog/dialog.css'
import 'codemirror/addon/search/search.js'
import 'codemirror/keymap/sublime.js'

// foldGutter
import 'codemirror/addon/fold/foldgutter.css'
import 'codemirror/addon/fold/brace-fold.js'
import 'codemirror/addon/fold/comment-fold.js'
import 'codemirror/addon/fold/foldcode.js'
import 'codemirror/addon/fold/foldgutter.js'
import 'codemirror/addon/fold/indent-fold.js'
import 'codemirror/addon/fold/markdown-fold.js'
import 'codemirror/addon/fold/xml-fold.js'

// more...

Vue.use(VueCodemirror)
