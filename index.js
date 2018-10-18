// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./ethereum')
const EthereumListners = require('./ethereum/workers')
const TasksPool = require('./TasksPool')

const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

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
      .on('blocks', async ({ from, to }) => {
        for (; from <= to; from++) {
          log(`Send to processing block #${from}`)
          await blocksPool.send({ blockNumber: from })
        }
      })
  })
