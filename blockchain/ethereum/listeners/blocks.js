require('dotenv').load()
const log = require('debug')('blockchain:ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum()

const repositories = require('../../../db/repositories')

repositories
  .connect()
  .then(({
    AddressesRepository,
    BlocksReposiroty,
    TransactionsRepository
  }) => {
    new TasksPool(NEW_BLOCKS_LISTNER)
      .connectAsReader(async ({ blockNumber }, done) => {
        log(`[#${blockNumber}] Start processing block`)

        try {
          // Make block from block data
          const { block, transactions } = await ethereum.getBlockData(blockNumber)

          if (transactions.length) {
            // Get transactions addresses
            const allAddressesOfBlock = [...new Set(
              [].concat(...transactions.map(transaction => {
                const result = []
                if (transaction.from) {
                  result.push(transaction.from)
                }
                if (transaction.to) {
                  result.push(transaction.to)
                }
                return result
              })
            ))]

            // Getting balances of new accounts
            const balancesForNewAccounts = await ethereum.getBalances(allAddressesOfBlock)

            // Insert accounts
            await AddressesRepository.upsert(Array.from(balancesForNewAccounts.keys()).map(address => ({ address, balance: balancesForNewAccounts.get(address), type: 'account' })))

            // Getting balances of contracts
            const allContractsAddressesOfBlock = transactions
              .filter(transaction => transaction.receipt.contractAddress)
              .map(transaction => transaction.receipt.contractAddress)

            if (allContractsAddressesOfBlock.length) {
              const balancesForNewContracts = await ethereum.getBalances(allContractsAddressesOfBlock)
              // Insert contracts
              await AddressesRepository.upsert(Array.from(balancesForNewContracts.keys()).map(address => ({ address, balance: balancesForNewContracts.get(address), type: 'account' })))
            }

            // Save transactions
            await TransactionsRepository.insert(transactions)
          }

          // Save block at last
          await BlocksReposiroty.insert(block)

          log(`[#${blockNumber}] Done (tx=${transactions.length})`)
          done()
        } catch (error) {
          log(`[#${blockNumber}] processing error`, error)
          process.exit()
        }
      })
  })
