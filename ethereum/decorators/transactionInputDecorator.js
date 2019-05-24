const { cleanWeb4DecodedFields } = require('../helpers')
const { AbiCoder } = require('web3-eth-abi')

module.exports = (transaction, abi) => {
  if (!abi) {
    return undefined
  }
  const methodsEntities = abi.filter(entity => (entity.type === 'function' && !entity.constant && entity.stateMutability !== 'view'))
  if (!methodsEntities.length) {
    return undefined
  }
  const methodHash = transaction.input.substring(0, 10)
  const methodData = methodsEntities.find(method => method._hash === methodHash)
  const methodArgumentsData = transaction.input.substring(10)
  const params = methodData.inputs.map(input => input.type)
  const args = Object.assign({}, AbiCoder().decodeParameters(params, '0x' + methodArgumentsData))

  return {
    name: methodData.name,
    code: methodData._signature,
    arguments: cleanWeb4DecodedFields(args)
  }
}
