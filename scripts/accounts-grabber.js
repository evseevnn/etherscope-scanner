/**
 * This script will collect all addresses from ethereum db
 * If address is contract also will saved abi information, properties and available methods
 */
require('dotenv').load()
const log = require('debug')('accounts-grabber')
const repositories = require('../db/repositories')

const CONTRACTS_PER_TIME = 100000

repositories
  .connect()
  .then(async ({
    AddressesRepository
  }) => {
    async function getNextAddresses(lastId = null) {
      let search = { type: AddressesRepository.ADDRESS_TYPE_CONTRACT, abi: { $exists: false } }
      if (lastId) {
        search = Object.assign(search, { _id: { $gt: lastId } })
      }
      const contracts = await AddressesRepository.find(search).limit(CONTRACTS_PER_TIME).toArray()
      if (contracts.length) {
        // Get contracts
        const contracts = contracts.map(contract => transaction.receipt.contractAddress)
        // Get accounts
        const accounts = [].concat(...transactions.map(transaction => [transaction.from, transaction.to]))

        const addressesForSave = Array.from(new Set([...contracts, ...accounts]))
        // Checing in db
        const accountsFromDatabase = await AddressesRepository.find({ address: { $in: addressesForSave } }, { address: 1 }).toArray()

        accountsFromDatabase.forEach(account => {
          const index = addressesForSave.findIndex(address => account.address === address)
          if (index >= 0) {
            addressesForSave.splice(index, 1)
          }
        })

        if (addressesForSave.length) {
          await AddressesRepository.insert(
            addressesForSave.map(address => {
              return {
                address,
                type: contracts.includes(address) ? AddressesRepository.ADDRESS_TYPE_CONTRACT : AddressesRepository.ADDRESS_TYPE_ACCOUNT,
                lastUpdateAt: parseInt(Date.now() / 1000)
              }
            })
          )
          log(`Saved ${addressesForSave.length} addresses`)
        }

        // Getting next part
        setImmediate(() => getNextAddresses(transactions[transactions.length - 1]._id))
      } else {
        log(`Finish`)
        process.exit()
      }
    }
    getNextAddresses()
  })
  .catch(log)
