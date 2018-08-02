// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./blockchain/ethereum')
const EthereumListners = require('./blockchain/ethereum/listeners')
const TasksPool = require('./TasksPool')
const ethereum = new Ethereum()

const MAX_BLOCKS_PER_TASK = +process.env.MAX_BLOCKS_PER_TASK || 50

// Start tracing ethereum network
const blocksPool = new TasksPool(EthereumListners.NEW_BLOCKS_LISTNER)
blocksPool
  .connectAsWriter()
  .then(() => {
    log('Ethereum blocks listner started')
    // Start tracing new blocks
    ethereum.traceNewBlocks()
    ethereum
      .on('blocks', ({ from, to }) => {
        // make chanks
        const amountOfBlocks = to - from
        // if only one block
        let amountOfChunks = Math.ceil(amountOfBlocks / MAX_BLOCKS_PER_TASK)
        const restForLastChunk = amountOfBlocks % MAX_BLOCKS_PER_TASK
        if (restForLastChunk > 0) {
          amountOfChunks--
        }
        let cursor = +from
        for (let i = 1; i < amountOfChunks; i++) {
          blocksPool.send({ from: cursor, to: (cursor + MAX_BLOCKS_PER_TASK - 1) })
          cursor = cursor + MAX_BLOCKS_PER_TASK
        }
        if (restForLastChunk > 0) {
          blocksPool.send({ from: cursor, to: (cursor + restForLastChunk) })
        }

        log(`Blocks ${from} -> ${to} send to processing`)
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
