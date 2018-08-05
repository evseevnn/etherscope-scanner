// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./blockchain/ethereum')
const EthereumListners = require('./blockchain/ethereum/listeners')
const TasksPool = require('./TasksPool')
const ethereum = new Ethereum()

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
        for (let blockNumber = from; blockNumber < to; blockNumber++) {
          setImmediate(blocksPool.send({ blockNumber }))
        }

        // cleaning
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
