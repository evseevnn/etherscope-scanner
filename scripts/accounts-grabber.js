/**
 * This script will collect all addresses from ethereum db
 * If address is contract also will saved abi information, properties and available methods
 */
require('dotenv').load()
const log = require('debug')('accounts-grabber')
const repositories = require('../db/repositories')

const TRANSACTIONS_PER_TIME = 1000

repositories
  .connect()
  .then(async ({
    AddressesRepository,
    TransactionsRepository
  }) => {
    async function getNextTransactionsAddresses(lastId = null) {
      let search = {}
      if (lastId) {
        search = { $gt: lastId }
      }
      const transactions = await TransactionsRepository.find(search).sort({ blockNumber: 1 }).limit(TRANSACTIONS_PER_TIME).toArray()
      if (transactions.length) {
        // Get contracts
        const contracts = transactions.map(transaction => transaction.receipt.contractAddress)
        // Get accounts
        const accounts = [].concat(...transactions.map(transaction => [transaction.from, transaction.to]))

        const addressesForSave = Array.from(new Set([...contracts, ...accounts]))
        // Checing in db
        const accountsFromDatabase = await AddressesRepository.find({ address: { $in: addressesForSave } }, { address: 1 }).toArray()

        accountsFromDatabase.forEach(account => {
          const index = addressesForSave.findIndex(account.address)
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
        setImmediate(() => getNextTransactionsAddresses(transactions[transactions.length - 1]._id))
      } else {
        log(`Finish`)
        process.exit()
      }
    }
    getNextTransactionsAddresses()
  })
  .catch(log)
