// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./blockchain/ethereum')
const EthereumListners = require('./blockchain/ethereum/listeners')
const TasksPool = require('./TasksPool')
const ethereum = new Ethereum()

const MAX_BLOCKS_PER_TIME = 100000

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
