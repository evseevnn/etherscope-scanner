require('dotenv').load()
const log = require('debug')('blockchain:ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_URL })

const repositories = require('../../../db/repositories')

repositories
  .connect()
  .then(({
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
            // Save transactions
            await TransactionsRepository.insert(transactions)
            // Replace transaction object on trnsaction hash in block
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
      })
  })
