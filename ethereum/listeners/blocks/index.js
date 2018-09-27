require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER, SAVED_TRANSACTIONS_LISTNER } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })
const transactionBeforeSaveDecorator = require('./decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('./decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')

// @FIXIT: PLS
// Exit after 1 hours of work.
// Need for temporary fix problem with memory overflow
// PM2 will start process again
setTimeout(() => {
  process.exit(0)
}, 1 * 60 * 60 * 1000)

const transactionsPool = new TasksPool(SAVED_TRANSACTIONS_LISTNER)

Promise.all([
  repositories.connect(),
  transactionsPool.connectAsWriter()
])
.then(([{
  AddressesRepository,
  BlocksReposiroty,
  InterfacesRepository,
  TransactionsRepository
}]) => {
  new TasksPool(NEW_BLOCKS_LISTNER)
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
          transactions.forEach(transaction => {
            transactionsPool.send({ hash: transaction.hash })
          })

          // Replace transaction object on transaction hash in block
          block.transactions = block.transactions.map(transaction => transaction.hash)
        }

        // Save block at last
        await BlocksReposiroty.insert(block)

        log(`[#${blockNumber}] Done (tx=${transactions.length})`)
        setImmediate(() => done())
      } catch (error) {
        log(`[#${blockNumber}] processing error`, error)
        process.exit()
      }
    } else {
      log(`[#${blockNumber}] Exist`)
      setImmediate(() => done())
    }
  })
})
