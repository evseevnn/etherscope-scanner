// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner:catching-up')
const EthereumListners = require('../ethereum/workers')
const TasksPool = require('../TasksPool')
const repositories = require('../db/repositories')

const Ethereum = require('../ethereum')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

// Connect to repositories
repositories
  .connect()
  .then(async ({
    BlocksReposiroty
  }) => {
    const blocksPool = new TasksPool(EthereumListners.CATCHING_UP_BLOCKS_LISTNER)
    const lastEtereumBlock = await ethereum.web3.eth.getBlockNumber()
    log(`Catching until [${lastEtereumBlock}]`)
    blocksPool
      .connectAsWriter()
      .then(async () => {
        // getting cursor
        const blocksAmount = await BlocksReposiroty.count({})
        let lastBlockNumber = 0
        if (blocksAmount > 0) {
          const cursor = await BlocksReposiroty.find({}, { number: 1 }).sort({ number: 1 })
          cursor.forEach(async (block) => {
            if (block.number === lastBlockNumber) {
              // Block exists
              lastBlockNumber++
            } else {
              // Block not found
              for (; lastBlockNumber < block.number; lastBlockNumber++) {
                await blocksPool.send({ blockNumber: lastBlockNumber })
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
        } else {
          for (; lastBlockNumber < lastEtereumBlock; lastBlockNumber++) {
            await blocksPool.send({ blockNumber: lastBlockNumber })
            log(`Catch skipped block [${lastBlockNumber}]`)
          }
          log('Finish')
        }
      })
  })
