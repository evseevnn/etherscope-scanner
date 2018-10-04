// Load environment variables
require('dotenv').load()
const log = require('debug')('scanner:pending-transactions')
const Ethereum = require('./ethereum')
const EthereumWorkers = require('./ethereum/workers')
const TasksPool = require('./TasksPool')
const repositories = require('./db/repositories')

// Connect to repositories
repositories
  .connect()
  .then(async ({
    TransactionsRepository
  }) => {
    const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })
    // Start tracing ethereum network
    const pendingTransactionsPool = new TasksPool(EthereumWorkers.PENDING_TRANSACTIONS_LISTNER)
    pendingTransactionsPool
      .connectAsWriter()
      .then(() => {
        log('Start tracing pending transactions')
        ethereum.web3.eth.subscribe('pendingTransactions')
          .on('data', transactionHash => {
            log(`New pending transaction with hash ${transactionHash}`)
            pendingTransactionsPool.send({ hash: transactionHash })
          })
      })
  })
