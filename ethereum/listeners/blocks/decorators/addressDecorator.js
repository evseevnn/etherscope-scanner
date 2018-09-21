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
          if (addressData.data && addressData.data.totalSupply) {
            addressData.data.totalSupply = (addressData.data.totalSupply / (Math.pow(10, addressData.data.decimals) || 1).toFixed(8).replace(/\.?0+$/, ''))
          }
          const { address, type, data, instanceOf } = addressData
          return { address, type, data, instanceOf }

        case 'address':
          return addressData

        default:
          throw new Error('Unknown address type')
      }
    }
  }

  // if record not exist
  return { address, type: 'address' }
}
