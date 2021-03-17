const debug = require('debug')('utils/upload_file')

const { isBinary } = require('istextorbinary')

export const uploadFile = (file, parent, callback) => {
  const reader = new FileReader()
  reader.addEventListener('loadend', () => {
    const binary = isBinary(
      file.name,
      Buffer.from(
        reader.result.substr(reader.result.indexOf(';base64,') + 8),
        'base64'
      )
    )
    debug(parent.path + '/' + file.name)
    const newFile = {
      name: file.name,
      path: parent.path + '/' + file.name,
      type: 'blob',
      binary,
      mode: '100644',
      content: binary
        ? reader.result.substr(reader.result.indexOf(';base64,') + 8)
        : atob(reader.result.substr(reader.result.indexOf(';base64,') + 8))
    }
    if (!binary) {
      newFile.encoding = 'utf-8'
    }
    callback(newFile)
  })
  reader.readAsDataURL(file)
}
