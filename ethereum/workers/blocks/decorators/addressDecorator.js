module.exports = async (address, AddressesRepository, lightMode = false, includeBalances = false) => {
  // if decorated need do it again
  if (typeof address === 'object' && address.address) {
    address = address.address
  }

  let returnData = { address, type: 'address', balance: 0, tokens: {} }

  if (!lightMode) {
    const [ addressData ] = await AddressesRepository.find({ address }, { opcode: -1 }).limit(1).toArray()
    if (addressData) {
      returnData = addressData
    }
  }

  if (includeBalances) {
    returnData = (({ address, type, data, instanceOf, balance = 0, tokens = {} }) => ({ address, type, data, instanceOf, balance, tokens }))(returnData)
  } else {
    returnData = (({ address, type, data, instanceOf }) => ({ address, type, data, instanceOf }))(returnData)
  }

  if (returnData.type !== 'contract') {
    delete returnData.instanceOf
  }

  return returnData
}
