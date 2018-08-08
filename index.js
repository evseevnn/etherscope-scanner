// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./blockchain/ethereum')
const EthereumListners = require('./blockchain/ethereum/listeners')
const TasksPool = require('./TasksPool')
const repositories = require('./db/repositories')

const MAX_BLOCKS_PER_TIME = 10000

// Connect to repositories
repositories
  .connect()
  .then(async ({
    BlocksReposiroty
  }) => {
    let firstBlockNumber = 0
    if (process.env.LAST_BLOCK_NUMBER === 'latest') {
      const [ lastBlock ] = await BlocksReposiroty.find({}, { number: 1 }).sort({ number: -1 }).limit(1).toArray()
      if (lastBlock && lastBlock.number) {
        firstBlockNumber = lastBlock.number
      }
    } else if (!isNaN(process.env.LAST_BLOCK_NUMBER)) {
      firstBlockNumber = parseInt(process.env.LAST_BLOCK_NUMBER)
    }

    const ethereum = new Ethereum({ firstBlockNumber })

    // Start tracing ethereum network
    const blocksPool = new TasksPool(EthereumListners.NEW_BLOCKS_LISTNER)
    blocksPool
      .connectAsWriter()
      .then(() => {
        log('Ethereum blocks listner started')

        if (global.gc) {
          setInterval(() => global.gc(), 5000)
        }

        // Start tracing new blocks
        ethereum.traceNewBlocks()
        ethereum
          .on('blocks', ({ from, to }) => {
            let cursor = from
            function sendBlocks() {
              for (let i = 0; cursor < to && i < MAX_BLOCKS_PER_TIME; i++) {
                log(`Send to processing block #${cursor}`)
                blocksPool.send({ blockNumber: cursor })
                cursor++
              }
              if (cursor < to) {
                setTimeout(() => sendBlocks(), 1000)
              }
            }

            sendBlocks()
          })
      })
  })

// // Tracing events
// const eventsPool = new TasksPool(EthereumListners.EVENTS_LISTNER)
// eventsPool
//   .connectAsWriter()
//   .then(() => {
//     log('Ethereum events listner started')
//     // Start tracing new events
//     ethereum.subscribe('logs', {})
//       .on('data', (data) => {
//         log(`[#${data.blockNumber}] ${data.logIndex}`)
//         eventsPool.push(data)
//       })
//   })
