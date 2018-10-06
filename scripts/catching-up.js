// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner:catching-up')
const EthereumListners = require('../ethereum/workers')
const TasksPool = require('../TasksPool')
const repositories = require('../db/repositories')

// Connect to repositories
repositories
  .connect()
  .then(async ({
    BlocksReposiroty
  }) => {
    const blocksPool = new TasksPool(EthereumListners.CATCHING_UP_BLOCKS_LISTNER)
    blocksPool
      .connectAsWriter()
      .then(async () => {
        // getting cursor
        const cursor = await BlocksReposiroty.find({}, { number: 1 }).sort({ number: 1 })
        let lastBlockNumber = 0
        cursor.forEach(block => {
          if (block.number === lastBlockNumber) {
            // Block exists
            lastBlockNumber++
          } else {
            // Block not found
            for (; lastBlockNumber < block.number; lastBlockNumber++) {
              blocksPool.send({ blockNumber: lastBlockNumber })
              log(`Catch skipped block [${lastBlockNumber}]`)
            }
          }
        }, (error) => {
          if (error) {
            log('Error: ', error)
          } else {
            log('Finish')
          }
          process.exit()
        })
      })
  })
