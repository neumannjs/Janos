import Vue from 'vue'
const sha1 = require('js-sha1')

export function findParentRecursive(array, file) {
  // This function is used to find and return the parent of a file.
  // This is needed to delete the file itself, knowing the array it is contained by.
  if (array.findIndex(i => i.path === file.path) > -1) {
    return array
  }

  for (let i = 0; i < array.length; i++) {
    if (array[i].children) {
      const ret = findParentRecursive(array[i].children, file)
      if (ret !== undefined) {
        return ret
      }
    }
  }
}

export function findOrCreateParent(tree, path) {
  if (!path.includes('/')) {
    // The file is at the root, the parent is the tree itself
    return tree
  } else {
    let array
    if (tree.constructor === Array) {
      // We are at the root of the fileTree (which is an array itself)
      // the array to use *is* the filetree
      array = tree
    } else {
      // We are in a branche of the filetree.
      // The array to use is the array that contains the children of the current branch
      array = tree.children
    }
    // Get the first folder of the path
    const folder = path.substring(0, path.indexOf('/'))
    // Find that folder in the array
    const indexOfFolder = array.findIndex(
      i => i.name === folder && i.type === 'tree'
    )
    if (indexOfFolder === -1) {
      // Create the folder when it is not found
      // UPDATE 20200625: I'm not sure whether this actually needed anymore.
      // When built there were situations where the file got updated before the folder was created
      // In these cases creating a folder that could not be found was useful.
      let folderPath = ''
      if (tree.path) {
        folderPath = tree.path
      }
      const folderObject = {
        children: [],
        mode: '040000',
        name: folder,
        path: folderPath + '/' + folder,
        type: 'tree'
      }
      if (folderObject.path.charAt(0) === '/') {
        folderObject.path = folderObject.path.substring(1)
      }
      array.push(folderObject)
      path = path.substring(path.indexOf('/') + 1)
      return findOrCreateParent(folderObject, path)
    } else {
      path = path.substring(path.indexOf('/') + 1)
      return findOrCreateParent(array[indexOfFolder], path)
    }
  }
}

export function findFileRecursive(array, path) {
  if (array.findIndex(f => f.path === path) > -1) {
    return array[array.findIndex(f => f.path === path)]
  }
  for (let i = 0; i < array.length; i++) {
    if (array[i].children) {
      const ret = findFileRecursive(array[i].children, path)
      if (ret !== undefined) {
        return ret
      }
    }
  }
}

export function filterFileTreeRecursive(array, pattern) {
  let a = []
  array
    .filter(
      file =>
        pattern.some(element => file.path.startsWith(element)) &&
        file.type === 'tree'
    )
    .forEach(
      file => (a = a.concat(filterFileTreeRecursive(file.children, pattern)))
    )

  a = a.concat(
    array.filter(
      file =>
        pattern.some(element => file.path.startsWith(element)) &&
        file.type !== 'tree'
    )
  )

  return a
}

export function addTreeItem(path, object, array) {
  if (path.indexOf('/') > 0) {
    const folder = path.substring(0, path.indexOf('/'))
    const folderObject = array.find(o => o.name === folder)

    if (!folderObject.children) {
      folderObject.children = []
    }
    path = path.substring(path.indexOf('/') + 1)
    addTreeItem(path, object, folderObject.children)
  } else {
    array.push({
      name: path,
      ...object
    })
  }
}

export function calculateSha1(file) {
  const contents = file.content
  let sha = null
  if (contents !== null) {
    let bytes
    if (!file.encoding || (file.encoding && file.encoding !== 'utf-8')) {
      bytes = Uint8Array.from(atob(contents), c => c.charCodeAt(0))
    } else {
      const enc = new TextEncoder()
      bytes = enc.encode(contents)
    }
    const wrapObject = wrap('blob', bytes.buffer)
    sha = sha1(wrapObject)
  }
  setFileSha(file, sha)
  return sha
}

export function setFileSha(file, sha) {
  // If the file has the `sha` property (it exists on Github) then check whether
  // the new sha value is equal. If not, set the `newSha` property to indicate
  // the file has changed. If it is equal, delete the `newSha` property to
  // indicate the file has not changed. If the file does not have the `sha`
  // property (it does not exist on Github) the `newSha` value should always be
  // set, except when the new sha value equals null. The latter case means that
  // the file was created (but not commited) and then deleted again. In that
  // case the `newSha` property is deleted to indicate that nothing has changed
  // (no file was added after all).
  if (file.sha) {
    if (file.sha !== sha) {
      Vue.set(file, 'newSha', sha)
    } else if (Object.prototype.hasOwnProperty.call(file, 'newSha')) {
      Vue.delete(file, 'newSha')
    }
  } else if (sha !== null) {
    Vue.set(file, 'newSha', sha)
  } else {
    Vue.delete(file, 'newSha')
  }
}

function wrap(type, object) {
  return Buffer.concat([
    Buffer.from(`${type} ${object.byteLength.toString()}\x00`),
    Buffer.from(object)
  ])
}

export function right(str, n) {
  if (n <= 0) return ''
  else if (n > String(str).length) return str
  else {
    const iLen = String(str).length
    return String(str).substring(iLen, iLen - n)
  }
}

export function left(str, n) {
  if (n <= 0) return ''
  else if (n > String(str).length) return str
  else return String(str).substring(0, n)
}
