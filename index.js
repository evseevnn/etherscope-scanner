// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./ethereum')
const EthereumListners = require('./ethereum/workers')
const TasksPool = require('./TasksPool')

const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

const NO_BLOCK_RESTART_TIMEOUT = 60000 // 60 seconds to restart if no new blocks
let noBlocksTimer = null

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
        // reset timer
        if (noBlocksTimer) {
          clearTimeout(noBlocksTimer)
        }
        for (; from <= to; from++) {
          log(`Send to processing block #${from}`)
          await blocksPool.send({ blockNumber: from })
        }
        noBlocksTimer = setTimeout(() => {
          log('No blocks...?! restarting...')
          process.exit()
        }, NO_BLOCK_RESTART_TIMEOUT)
      })
  })
