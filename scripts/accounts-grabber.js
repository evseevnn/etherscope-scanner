/**
 * This script will collect all addresses from ethereum db
 * If address is contract also will saved abi information, properties and available methods
 */
require('dotenv').load()
const log = require('debug')('accounts-grabber')
const repositories = require('../db/repositories')

repositories
  .connect()
  .then(async ({
    AddressesRepository,
    TransactionsRepository
  }) => {
    let lastProcessedBlock = 0
    // Getting all creation contracts
    const addresses = new Map()
    await TransactionsRepository
      .find()
      .sort({ blockNumber: 1 })
      .forEach(async transaction => {
        if (lastProcessedBlock === 0) {
          lastProcessedBlock = transaction.blockNumber
        }
        log(`[#${transaction.blockNumber}] Getting addresses from block`)
        // Need save it one time per block
        if (lastProcessedBlock < transaction.blockNumber) {
          const allAccountsAddresses = Array.from(addresses.keys())

          // Get accounts from database for exclude from next ethereum request and saving to db
          const accountsFromDatabase = await AddressesRepository.find({ address: { $in: allAccountsAddresses } }, { address: 1 }).toArray()

          // Clean saving batch
          accountsFromDatabase.forEach(account => {
            addresses.delete(account.address)
          })

          // Need save data
          if (addresses.size) {
            log(`[#${transaction.blockNumber}] Trying save ${addresses.size} addresses`)
            await AddressesRepository.insert(Array.from(addresses.values()))
            addresses.clear()
          }
          lastProcessedBlock = transaction.blockNumber
          log(`[${lastProcessedBlock}] Saved`)
        }

        // Collect addresses from transaction
        if (transaction.from) {
          addresses.set(transaction.from, {
            address: transaction.from,
            type: AddressesRepository.ADDRESS_TYPE_ACCOUNT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          })
        }

        if (transaction.to) {
          addresses.set(transaction.to, {
            address: transaction.to,
            type: AddressesRepository.ADDRESS_TYPE_ACCOUNT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          })
        }

        // if transaction has contract creation
        if (transaction.receipt.contractAddress) {
          addresses.set(transaction.receipt.contractAddress, {
            address: transaction.receipt.contractAddress,
            type: AddressesRepository.ADDRESS_TYPE_CONTRACT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          })
        }
      })
  })
  .catch(log)
