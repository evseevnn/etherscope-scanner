const log = require('debug')('ethereum:listners:contracts-processing')
const Ethereum = require('../../..')
const ethereum = new Ethereum(process.env.ETHEREUM_NODE_HTTP)

/**
 * ONLY FOR CONTRACTS ADDRESSES
 */
module.exports = async ({ addresses, blockNumber, createdAt, AddressesRepository }) => {
  const addressesForSave = []
  if (addresses.length) {
    // Get get exists contracts
    const existContractsAddresses = (await AddressesRepository.find({ address: { $in: addresses }, opcode: { $exists: true, $ne: '' } }).toArray()).map(contract => contract.address)
    addresses = addresses.filter(address => !existContractsAddresses.includes(address))

    if (addresses.length) {
      // Save contracts
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]
        log(`Checing ${address}`)
        const code = await ethereum.getContractCode(address)
        if (code) {
          const { abi, instanceOf } = await ethereum.getContractInterfaces(address, code)
          const data = await ethereum.getContractDataByInterfaces(address, abi)
          if (data && data.totalSupply && data.decimals) {
            data.totalSupply = (data.totalSupply / (Math.pow(10, data.decimals) || 1).toFixed(8).replace(/\.?0+$/, ''))
          }
          log(`[${address}]${instanceOf.length ? ` interfaces: ${instanceOf.join(', ')}` : ' Unknown contract type'}`)
          addressesForSave.push({
            instanceOf,
            abi,
            data,
            code,
            address,
            type: 'contract',
            blockNumber,
            createdAt
          })
        }
      }

      if (addressesForSave.length) {
        await AddressesRepository.update(addressesForSave, ['address'], true)
      }
    }
  }

  return addressesForSave
}
