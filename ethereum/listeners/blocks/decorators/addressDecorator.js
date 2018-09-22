module.exports = async (address, AddressesRepository, lightMode = false) => {
  // if decorated need do it again
  if (typeof address === 'object' && address.address) {
    address = address.address
  }
  if (!lightMode) {
    const [ addressData ] = await AddressesRepository.find({ address }, { opcode: -1 }).limit(1).toArray()
    if (addressData) {
      switch (addressData.type) {
        case 'contract':
          const { address, type, data, instanceOf, balance = 0, tokens = {} } = addressData
          return { address, type, data, instanceOf, balance, tokens }

        case 'address':
          return addressData

        default:
          throw new Error('Unknown address type')
      }
    }
  }

  // if record not exist
  return { address, type: 'address', balance: 0, tokens: {} }
}
