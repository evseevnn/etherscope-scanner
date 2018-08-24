require('dotenv').load()
const log = require('debug')('scripts:set-contracts-instances')
const repositories = require('../db/repositories')
const Ethereum = require('../ethereum')

const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_URL })

const CONTRACTS_PER_TIME = 10000

repositories
  .connect()
  .then(async ({ AddressesRepository }) => {
    async function getNextAddresses(lastId = null) {
      let search = { type: AddressesRepository.ADDRESS_TYPE_CONTRACT, instanceOf: { $exists: false } }

      if (lastId) {
        search = Object.assign(search, { _id: { $gt: lastId } })
      }

      const contracts = await AddressesRepository.find(search).limit(CONTRACTS_PER_TIME).toArray()
      if (contracts.length) {
        contracts.forEach(contract => {
          contract.instanceOf = ethereum.getContractInterfaces(contract.address)
          log(`[${contract.address}] instanceOf `, contract.instanceOf)
        })

        await AddressesRepository.upsert(contracts)

        // Getting next part
        setImmediate(() => getNextAddresses(contracts[contracts.length - 1]._id))
      } else {
        log(`Finish`)
        process.exit()
      }
    }
    getNextAddresses()
  })
  .catch(() => log())
