require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER, CATCHING_UP_BLOCKS_LISTNER, CONTRACTS_PROCESSING, EVENTS_PROCESSING } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })
const transactionBeforeSaveDecorator = require('../../decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')

const contractsProcessingPool = new TasksPool(CONTRACTS_PROCESSING)
const eventsProcessingPool = new TasksPool(EVENTS_PROCESSING)

Promise.all([
  repositories.connect(),
  contractsProcessingPool.connectAsWriter(),
  eventsProcessingPool.connectAsWriter()
])
.then(([{
  AddressesRepository,
  BlocksReposiroty,
  InterfacesRepository,
  TransactionsRepository
}]) => {
  new TasksPool(process.env.CATCHING_UP_MODE ? CATCHING_UP_BLOCKS_LISTNER : NEW_BLOCKS_LISTNER)
  .connectAsReader('blocks', async ({ blockNumber }, done) => {
    log(`[#${blockNumber}] Start processing block`)

    const [ isBlockExist ] = await BlocksReposiroty.find({ number: blockNumber }).limit(1).toArray()

    if (!isBlockExist) {
      try {
        // Getting all block data
        log(`[#${blockNumber}] Getting block data`)
        let { block, transactions } = await ethereum.getBlockData(blockNumber)
        log(`[#${blockNumber}] Prepare and save`)

        if (transactions.length) {
          // Get exists transactions for block
          const existsHashes = (await TransactionsRepository.find({ blockNumber }).toArray()).map(transaction => transaction.hash)
          // clean
          transactions = transactions.filter(transaction => !existsHashes.includes(transaction.hash))
          // Decorate transactions
          for (let i = 0; i < transactions.length; i++) {
            const decoratedBeforeTransaction = await transactionBeforeSaveDecorator(transactions[i], AddressesRepository)
            const decoratedAfterTransaction = await transactionAfterSaveDecorator(transactions[i], InterfacesRepository, AddressesRepository, true)
            transactions[i] = Object.assign(
              transactions[i],
              decoratedBeforeTransaction,
              decoratedAfterTransaction,
              {
                addedAt: new Date(),
                createdAt: new Date(block.timestamp * 1000)
              })
          }

          // Save last transactions
          await TransactionsRepository.update(transactions, ['hash'], true)

          log(`[#${blockNumber}] Send ${transactions.length} transactions to processing`)
          for (let i = 0; i < transactions.length; i++) {
            await Promise.all([
              // Send to contract processing
              contractsProcessingPool.send({ hash: transactions[i].hash }),
              // Send to balance updating
              eventsProcessingPool.send({ hash: transactions[i].hash })
            ])
          }

          // Replace transaction object on transaction hash in block
          block.transactions = block.transactions.map(transaction => transaction.hash)
        }

        // Save block at last
        await BlocksReposiroty.insert(block)

        log(`[#${blockNumber}] Done (tx=${transactions.length})`)


        if (global.gc) {
          global.gc()
          setTimeout(() => done(), 10)
        } else {
          setTimeout(() => done(), 10)
        }
      } catch (error) {
        log(`[#${blockNumber}] processing error`, error)
        process.exit()
      }
    } else {
      log(`[#${blockNumber}] Exist`)
      done()
    }
  })
})
