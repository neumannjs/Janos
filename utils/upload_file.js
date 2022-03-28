import { sniffKeyType, processFiles } from '../../frontend-image-encode/lib2'
const { Base64 } = require('js-base64')

const debug = require('debug')('utils/upload_file')

const { isBinary } = require('istextorbinary')

export const uploadFile = (file, parent, callback, rename) => {
  console.log(typeof file)
  const reader = new FileReader()
  reader.addEventListener('loadend', () => {
    const binary = isBinary(
      file.name,
      Buffer.from(
        reader.result.substr(reader.result.indexOf(';base64,') + 8),
        'base64'
      )
    )
    const newFile = _newFile(
      rename || file.name,
      parent.path,
      binary,
      reader.result.substr(reader.result.indexOf(';base64,') + 8)
    )

    callback(newFile)
  })
  reader.readAsDataURL(file)
}

export const uploadAndResizeFile = async (
  file,
  parent,
  conf,
  callback,
  rename,
  devicePixelRatio = 1
) => {
  // Check for image files
  try {
    await sniffKeyType(file)
  } catch (e) {
    debug('%s is not an image file, default to vanilla upload', file.name)
    uploadFile(file, parent, callback, rename)
    return
  }
  // Upload the original file (unprocessed)
  uploadFile(file, parent, callback, rename)

  file.rename = rename
  const imgFiles = await processFiles(file, conf)
  const returnImages = imgFiles.get(file)

  // Upload all processed files
  for (let i = 0; i < conf.format.length; i++) {
    for (let j = 0; j < returnImages[conf.format[i]].length; j++) {
      const image = returnImages[conf.format[i]][j]
      const b64encoded = Base64.fromUint8Array(image.data)
      const newFile = _newFile(image.name, parent.path, true, b64encoded)
      callback(newFile)
    }
  }
}

function _newFile(name, folder, binary, content) {
  const newFile = {
    name,
    path: folder + '/' + name,
    type: 'blob',
    binary,
    mode: '100644',
    content: binary ? content : Base64.encode(content)
  }
  if (!binary) {
    newFile.encoding = 'utf-8'
  }
  return newFile
}
