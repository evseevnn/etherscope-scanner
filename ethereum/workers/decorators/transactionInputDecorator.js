const { cleanWeb4DecodedFields } = require('../../helpers')
const ABICoder = require('web3-eth-abi')

module.exports = (transaction, interfaces, instanceOf) => {
  const methods = {}
  interfaces.forEach(interfaceData => {
    if (instanceOf.includes(interfaceData.contractName)) {
      const methodsEntities = interfaceData.abi.filter(entity => (entity.type === 'function' && !entity.constant && entity.stateMutability !== 'view'))
      methodsEntities.forEach(method => {
        methods[method._hash] = method
      })
    }
  })

  let method = {}
  // Getting calling method
  const methodHash = transaction.input.substring(0, 10)
  if (methods[methodHash]) {
    const methodArgumentsData = transaction.input.substring(10)
    const params = methods[methodHash].inputs.map(input => input.type)
    const args = Object.assign({}, ABICoder.decodeParameters(params, methodArgumentsData))

    method = {
      name: methods[methodHash].name,
      code: methods[methodHash]._signature,
      arguments: cleanWeb4DecodedFields(args)
    }
  }

  return method
}
