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
    let addresses = {}
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
          const allAccountsAddresses = Object.keys(addresses)

          // Get accounts from database for exclude from next ethereum request and saving to db
          const accountsFromDatabase = await AddressesRepository.find({ address: { $in: allAccountsAddresses } }, { address: 1 }).toArray()
          // Clean saving batch
          accountsFromDatabase.forEach(account => {
            delete addresses[account.address]
          })

          // Need save data
          const addressesData = Object.values(addresses.values())
          if (addressesData.length) {
            log(`[#${transaction.blockNumber}] Trying save ${addressesData.length} addresses`)
            await AddressesRepository.insert(addressesData)
            addresses = {}
          }
          lastProcessedBlock = transaction.blockNumber
          log(`[${lastProcessedBlock}] Saved`)
        }

        // Collect addresses from transaction
        if (transaction.from) {
          addresses[transaction.from] = {
            address: transaction.from,
            type: AddressesRepository.ADDRESS_TYPE_ACCOUNT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          }
        }

        if (transaction.to) {
          addresses[transaction.to] = {
            address: transaction.to,
            type: AddressesRepository.ADDRESS_TYPE_ACCOUNT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          }
        }

        // if transaction has contract creation
        if (transaction.receipt.contractAddress) {
          addresses[transaction.receipt.contractAddress] = {
            address: transaction.receipt.contractAddress,
            type: AddressesRepository.ADDRESS_TYPE_CONTRACT,
            lastUpdateAt: parseInt(Date.now() / 1000)
          }
        }
      })
  })
  .catch(log)
