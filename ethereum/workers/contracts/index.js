require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { CONTRACTS_PROCESSING } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const repositories = require('../../../db/repositories')
const contractsProcessingPool = new TasksPool(CONTRACTS_PROCESSING)

Promise.all([
  repositories.connect(),
  contractsProcessingPool.connect()
])
  .then(([{
    AddressesRepository,
    TransactionsRepository
  }]) => {
    contractsProcessingPool.subscribe()

    contractsProcessingPool.on('data', async msg => {
      const { hash, blockNumber, createdAt } = JSON.parse(Buffer.from(msg.content).toString())
      log(`[${hash}] Start processing transaction`)
      try {
        // Getting all block data for another process
        let [ transaction ] = await TransactionsRepository.find({ hash, receipt: { $exists: true, $ne: null }, isContractProcessed: { $ne: true } }).toArray()

        if (transaction) {
          // Contract processing
          const contractAddresses = new Set()
          if (transaction.receipt.contractAddress) {
            contractAddresses.add(transaction.receipt.contractAddress)
          }
          // from
          if (
            typeof transaction.from === 'object' &&
            transaction.from.address &&
            transaction.from.type === 'contract'
          ) {
            contractAddresses.add(transaction.from.address)
          } else if (typeof transaction.from === 'string') {
            contractAddresses.add(transaction.from)
          }
          // to
          if (
            typeof transaction.to === 'object' &&
            transaction.to.address &&
            transaction.to.type === 'contract'
          ) {
            contractAddresses.add(transaction.to.address)
          } else if (typeof transaction.to === 'string') {
            contractAddresses.add(transaction.to)
          }
          // logs addresses
          transaction.receipt.logs.forEach(log => {
            contractAddresses.add(log.address)
          })

          await contractsProcessing({
            addresses: Array.from(contractAddresses),
            blockNumber,
            createdAt,
            AddressesRepository
          })

          log(`[${hash}] Done`)
        } else {
          log(`[${hash}] Not found. Transaction can be processed already or has no receipt`)
        }

        contractsProcessingPool.done(msg)
      } catch (error) {
        log(`[${hash}] processing error`, error)
        process.exit()
      }
    })
  })
