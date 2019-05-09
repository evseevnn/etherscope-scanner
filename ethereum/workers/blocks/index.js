require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER, CATCHING_UP_BLOCKS_LISTNER, CONTRACTS_PROCESSING, EVENTS_PROCESSING } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum(process.env.ETHEREUM_NODE)
const transactionBeforeSaveDecorator = require('../../decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')

const contractsProcessingPool = new TasksPool(CONTRACTS_PROCESSING)
const eventsProcessingPool = new TasksPool(EVENTS_PROCESSING)

Promise.all([
  repositories.connect(),
  contractsProcessingPool.connectAsWriter(),
  eventsProcessingPool.connectAsWriter()
])
.then(([{
  AddressesRepository,
  BlocksReposiroty,
  InterfacesRepository,
  TransactionsRepository
}]) => {
  new TasksPool(process.env.CATCHING_UP_MODE ? CATCHING_UP_BLOCKS_LISTNER : NEW_BLOCKS_LISTNER)
  .connectAsReader('blocks', async ({ blockNumber }, done) => {
    log(`[${blockNumber}] Start processing block`)

    const [ isBlockExist ] = await BlocksReposiroty.find({ number: blockNumber.toString() }).limit(1).toArray()

    if (!isBlockExist) {
      try {
        // Getting all block data
        log(`[${blockNumber}] Getting block data`)
        let { block, transactions } = await ethereum.getBlockData(blockNumber)
        log(`[${blockNumber}] Prepare and save`)

        if (transactions.length) {
          // Get exists transactions for block
          const existsHashes = (await TransactionsRepository.find({ blockNumber }).toArray()).map(transaction => transaction.hash)
          // clean
          transactions = transactions.filter(transaction => !existsHashes.includes(transaction.hash))
          // Decorate transactions
          for (let i = 0; i < transactions.length; i++) {
            transactions[i] = JSON.parse(JSON.stringify(transactions[i]))
            const decoratedBeforeTransaction = await transactionBeforeSaveDecorator(transactions[i], AddressesRepository)
            const decoratedAfterTransaction = await transactionAfterSaveDecorator(transactions[i], InterfacesRepository, AddressesRepository, true)
            transactions[i] = Object.assign(
              transactions[i],
              decoratedBeforeTransaction,
              decoratedAfterTransaction,
              {
                addedAt: new Date(),
                createdAt: new Date(block.timestamp * 1000)
              })
            // Transaction complete checking
            transactions[i].isTransferComplete = (
              transactions[i].method &&
              ['transferFrom', 'transfer'].includes(transactions[i].method.name) &&
              (
                transactions[i].events.findIndex(event => (
                    event.address.address === transactions[i].to.address &&
                    event.name === 'Transfer' &&
                    event.data.value === (transactions[i].method.name === 'transfer' ? transactions[i].method.arguments[1] : transactions[i].method.arguments[2])
                  )
                ) > -1
              )
            )
            // if no contract no need to do contract processing
            if (transactions[i].receipt && !transactions[i].receipt.contractAddress) {
              transactions[i].isContractProcessed = true
            }
          }
        }

        // if has flag for no save transaction we will skip all transaction what not about contract creation
        if (process.env.NO_SAVE_TRANSACTION) {
          transactions = transactions.filter(transaction => (transaction.receipt && transaction.receipt.contractAddress))
        }
        if (transactions.length) {
          // Save last transactions
          await TransactionsRepository.update(transactions, ['hash'], true)
          log(`[${blockNumber}] Sending transactions to processing`)
          let txCounter = 0
          for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].receipt && transactions[i].receipt.contractAddress) {
              await contractsProcessingPool.send({ hash: transactions[i].hash })
              txCounter++
            }
          }
          log(`[${blockNumber}] Send ${txCounter} transactions to processing`)
        }

        // Replace transaction object on transaction hash in block
        block.transactions = block.transactions.map(transaction => transaction.hash)

        // Save block at last
        await BlocksReposiroty.insert(JSON.parse(JSON.stringify(block)))

        log(`[${blockNumber}] Done (tx=${transactions.length})`)

        done()
      } catch (error) {
        log(`[${blockNumber}] processing error`, error)
        process.exit()
      }
    } else {
      log(`[${blockNumber}] Exist`)
      done()
    }
  })
})
