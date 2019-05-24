require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const {
  NEW_BLOCKS_LISTNER,
  CATCHING_UP_BLOCKS_LISTNER,
  CONTRACTS_PROCESSING,
  EVENTS_PROCESSING,
  BALANCES_PROCESSING
} = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum(process.env.ETHEREUM_NODE_HTTP)
const transactionBeforeSaveDecorator = require('../../decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')
const balanceProcessing = require('./modules/balances')

const balancesProcessingPool = new TasksPool(BALANCES_PROCESSING)
const contractsProcessingPool = new TasksPool(CONTRACTS_PROCESSING)
const eventsProcessingPool = new TasksPool(EVENTS_PROCESSING)
const blocksTasksPool = new TasksPool(process.env.CATCHING_UP_MODE ? CATCHING_UP_BLOCKS_LISTNER : NEW_BLOCKS_LISTNER)

async function boot() {
  let [{
    AddressesRepository,
    BlocksReposiroty,
    TransactionsRepository
  }] = await Promise.all([
    repositories.connect(),
    blocksTasksPool.connect(),
    contractsProcessingPool.connect(),
    eventsProcessingPool.connect(),
    balancesProcessingPool.connect()
  ])
  blocksTasksPool.subscribe()

  const calculateBalance = await balanceProcessing({ repositories: { AddressesRepository }, ethereum })

  setInterval(() => {
    global.gc && global.gc()
  }, 1000)

  blocksTasksPool.on('data', async (msg) => {
    const { blockNumber } = JSON.parse(Buffer.from(msg.content).toString())
    log(`[${blockNumber}] Start processing block`)
    const [ isBlockExist ] = await BlocksReposiroty.find({ number: blockNumber.toString() }).limit(1).toArray()
    if (blockNumber && !isBlockExist) {
      try {
        // Getting all block data
        log(`[${blockNumber}] Getting block data`)
        let { block, transactions } = await ethereum.getBlockData(blockNumber)
        log(`[${blockNumber}] Prepare and save`)

        block.transactions = []

        if (transactions.length) {
          // Decorate transactions
          for (let i = 0; i < transactions.length; i++) {
            const decoratedBeforeTransaction = await transactionBeforeSaveDecorator(transactions[i], AddressesRepository)
            const decoratedAfterTransaction = await transactionAfterSaveDecorator(transactions[i], AddressesRepository, calculateBalance)
            transactions[i] = Object.assign(
              transactions[i],
              decoratedBeforeTransaction,
              decoratedAfterTransaction,
              {
                addedAt: new Date(),
                createdAt: block.timestamp
              })

            // if no contract no need to do contract processing
            if (transactions[i].receipt && !transactions[i].receipt.contractAddress) {
              transactions[i].isContractProcessed = true
            }

            // add hash of transaction to block
            block.transactions.push(transactions[i].hash)
          }

          // Save last transactions
          await TransactionsRepository.update(transactions, ['hash'], true)
          // we can send transactions to processing only after save them
          log(`[${blockNumber}] Sending transactions to processing`)
          let txCounter = 0
          for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].receipt && transactions[i].receipt.contractAddress) {
              await contractsProcessingPool.send({
                hash: transactions[i].hash,
                blockNumber,
                createdAt: block.timestamp
              })
              txCounter++
            }
            // If transaction is success
            if (+transactions[i].status) {
              await calculateBalance({
                from: transactions[i].from.address,
                to: transactions[i].to.address,
                amount: transactions[i].value
              })
            }
          }
          log(`[${blockNumber}] Send ${txCounter} transactions to processing`)
        }

        // Save block at last
        await BlocksReposiroty.insert(block)

        log(`[${blockNumber}] Done (tx=${transactions.length})`)
        blocksTasksPool.done(msg)
      } catch (error) {
        log(`[${blockNumber}] processing error`, error)
        process.exit()
      }
    } else {
      log(`[${blockNumber}] Exist`)
      blocksTasksPool.done(msg)
    }
  })
}

boot()
