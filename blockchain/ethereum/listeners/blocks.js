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

            // Getting balances of contracts
            const allContractsAddressesOfBlock = transactions
              .filter(transaction => transaction.receipt.contractAddress)
              .map(transaction => transaction.receipt.contractAddress)

            const allAccountsInTransactions = [].concat(allAddressesOfBlock, allContractsAddressesOfBlock)

            // Check addresses balances from db
            let addressesInRepository = await AddressesRepository.find({ address: { $in: allAccountsInTransactions }, lastUpdateAt: { $gt: block.timestamp } }, { address: 1 })
            addressesInRepository = (await addressesInRepository.toArray()).map(account => account.address)

            const addressesForUpdate = allAccountsInTransactions.filter(address => !addressesInRepository.includes(address))

            if (addressesForUpdate.length) {
              // Getting balances for accounts
              const balancesForNewAccounts = await ethereum.getBalances(addressesForUpdate)

              // Insert accounts
              await AddressesRepository.upsert(addressesForUpdate.map(address => ({
                address,
                balance: balancesForNewAccounts.get(address) || 0,
                type: allContractsAddressesOfBlock.includes(address) ? 'contract' : 'account',
                lastUpdateAt: parseInt(Date.now() / 1000)
              })))
            }

            // Save transactions
            await TransactionsRepository.insert(transactions)
          }

          // Save block at last
          await BlocksReposiroty.insert(block)

          log(`[#${blockNumber}] Done (tx=${transactions.length})`)
          setImmediate(() => done())
        } catch (error) {
          log(`[#${blockNumber}] processing error`, error)
          process.exit()
        }
      })
  })
