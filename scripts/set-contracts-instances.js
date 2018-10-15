require('dotenv').load()
const log = require('debug')('scripts:set-contracts-instances')
const repositories = require('../db/repositories')
const Ethereum = require('../ethereum')

const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

const CONTRACTS_PER_TIME = 10

repositories
  .connect()
  .then(async ({ AddressesRepository }) => {
    async function getNextAddresses(lastId = null) {
      let search = { type: 'contract', instanceOf: { $exists: false } }

      if (lastId) {
        search = Object.assign(search, { _id: { $gt: lastId } })
      }

      const contracts = await AddressesRepository.find(search).limit(CONTRACTS_PER_TIME).toArray()
      if (contracts.length) {
        const promises = []
        contracts.forEach(contract => {
          // ???getContractOpcode is async now
          // const opcode = await ethereum.getContractOpcode(contract.address)
          // const interfaces = ethereum.getContractInterfaces(contract.address, opcode)
          // log(`[${contract.address}] instanceOf ${interfaces.join(', ')}`)
          // promises.push(ethereum.getContractDataByInterfaces(contract.address, interfaces).then(data => {
          //   contract.instanceOf = interfaces
          //   contract.data = data
          //   contract.opcode = opcode
          //   return contract
          // }))
        })

        await AddressesRepository.update(await Promise.all(promises), ['address'], true)

        // Getting next part
        setImmediate(() => getNextAddresses(contracts.pop()._id))
      } else {
        log(`Finish`)
        process.exit()
      }
    }
    getNextAddresses()
  })
  .catch((error) => log(error))
