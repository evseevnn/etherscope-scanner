const glob = require('glob')
const path = require('path')

const interfaces = {}
glob.sync('types/*.json', { cwd: __dirname })
  .forEach(file => {
    const type = path.basename(file, '.json')
    const typeData = require(`./types/${type}.json`)
    if (!typeData.abi || !typeData.abi.length) {
      throw new Error(`Contract type ${type} is not correct`)
    }
    interfaces[type] = typeData
  })

const interfacesFunctions = {}
const abi = {}
const events = {}
Object.keys(interfaces).forEach(interfaceName => {
  const abiEntities = interfaces[interfaceName].abi
  const hashes = []
  abiEntities.forEach(abiEntity => {
    const hash = abiEntity._hash.substring(2)
    abi[hash] = abiEntity
    if (abiEntity.name) {
      switch (abiEntity.type) {
        case 'function':
          hashes.push(hash)
          break
        case 'event':
          events[hash] = abiEntity
          break
      }
    }
  })
  if (hashes.length) {
    interfacesFunctions[interfaceName] = hashes
  }
})

module.exports = {
  interfacesFunctions, // Functions by interface
  events, // All available events (that need because of in contract code no information about events)
  abi, // All available ABI of interfaces
  interfaces // All available interfaces
}
