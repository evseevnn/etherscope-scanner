module.exports = async (address, AddressesRepository) => {
  // if decorated need do it again
  if (typeof address === 'object' && address.address) {
    return address
  }

  // By default all accounts has type 'address'
  let returnData = { address, type: 'address', balance: 0, tokens: {}, incrementUpdateCounter: 0 }

  // trying find address in DB
  const [ addressData ] = await AddressesRepository.find({ address }, { code: false }).limit(1).toArray()
  if (addressData) {
    // Fill returnData
    returnData = (({ address, abi, type, data, instanceOf, balance = 0, tokens = {}, incrementUpdateCounter = 0 }) => ({ address, abi, type, data, instanceOf, balance, tokens, incrementUpdateCounter }))(addressData)
  }

  // If account it's not contract, no need save data and instanceOf info
  if (returnData.type !== 'contract') {
    delete returnData.abi
    delete returnData.data
    delete returnData.instanceOf
  } else {
    console.log('contract')
  }

  return returnData
}
