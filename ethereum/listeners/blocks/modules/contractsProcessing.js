const log = require('debug')('ethereum:listners:blocks:contracts')
const Ethereum = require('../../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

/**
 * ONLY FOR CONTRACTS ADDRESSES
 */
module.exports = async ({ addresses, AddressesRepository }) => {
  if (addresses.length) {
    // Get get exists contracts
    const existContractsAddresses = (await AddressesRepository.find({ address: { $in: addresses } }).toArray()).map(contract => contract.address)
    addresses = addresses.filter(address => !existContractsAddresses.includes(address))

    if (addresses.length) {
      // Save contracts
      const addressesForSave = []
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]
        const opcode = ethereum.getContractOpcode(address)
        if (opcode) {
          const interfaces = ethereum.getContractInterfaces(address, opcode)
          const data = await ethereum.getContractDataByInterfaces(address, interfaces)
          if (data && data.totalSupply && data.decimals) {
            data.totalSupply = (data.totalSupply / (Math.pow(10, data.decimals) || 1).toFixed(8).replace(/\.?0+$/, ''))
          }
          log(`[${address}]${interfaces.length ? ` interfaces: ${interfaces.join(', ')}` : ' Unknown contract type'}`)
          addressesForSave.push({
            instanceOf: interfaces,
            data,
            opcode,
            address,
            type: 'contract'
          })
        } else {
          addressesForSave.push({
            address,
            type: 'address',
            balance: 0,
            tokens: {}
          })
        }
      }

      if (addressesForSave.length) {
        await AddressesRepository.update(addressesForSave, ['address'], true)
      }
    }
  }
}
