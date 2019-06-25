// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner')
const Ethereum = require('./ethereum')
const EthereumListners = require('./ethereum/workers')
const TasksPool = require('./TasksPool')

const ethereum = new Ethereum(process.env.ETHEREUM_NODE_WS)

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// Start tracing ethereum network
const blocksPool = new TasksPool(EthereumListners.NEW_BLOCKS_LISTNER)
blocksPool
  .connect()
  .then(() => {
    log('Ethereum blocks listner started')

    if (global.gc) {
      setInterval(() => global.gc(), 5000)
    }

    // Start tracing new blocks
    const startFrom = process.env.START_FROM || -1
    ethereum.subscribeOnNewBlocks(startFrom)
    ethereum
      .on('blocks', async ({ from, to }) => {
        for (; from <= to; from++) {
          log(`Send to processing block #${from}`)
          await sleep(1)
          blocksPool.send({ blockNumber: from })
        }
      })
  })
