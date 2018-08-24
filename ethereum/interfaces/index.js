const glob = require('glob')
const path = require('path')

const availableTypes = {}
glob.sync('types/*.json', { cwd: __dirname })
  .forEach(file => {
    const type = path.basename(file, '.json')
    const typeData = require(`./types/${type}.json`)
    if (!typeData.abi || !typeData.abi.length) {
      throw new Error(`Contract type ${type} is not correct`)
    }
    availableTypes[type] = typeData.abi.map(method => {
      return method._hash
    })
  })

module.exports = availableTypes
