const log = require('debug')('ethereum:listners:blocks:contracts')
const Ethereum = require('../../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

/**
 * ONLY FOR CONTRACTS ADDRESSES
 */
module.exports = async ({ addresses, AddressesRepository }) => {
  if (addresses.length) {
    // Get get exists contracts
    const existContractsAddresses = (await AddressesRepository.find({ address: { $in: addresses }, type: 'contract' }).toArray()).map(contract => contract.address)
    addresses = addresses.filter(address => !existContractsAddresses.includes(address))

    if (addresses.length) {
      // Save contracts
      const addressesForSave = []
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i]
        const opcode = ethereum.getContractOpcode(address)
        const interfaces = ethereum.getContractInterfaces(address, opcode)
        const data = await ethereum.getContractDataByInterfaces(address, interfaces)
        log(`[${address}]${interfaces.length ? ` interfaces: ${interfaces.join(', ')}` : ' Unknown contract type'}`)
        addressesForSave.push({
          instanceOf: interfaces,
          data,
          opcode,
          address,
          type: 'contract'
        })
      }

      await AddressesRepository.update(addressesForSave, ['address'], true)
    }
  }
}
