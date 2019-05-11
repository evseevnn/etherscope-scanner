require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { CONTRACTS_PROCESSING } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')

const repositories = require('../../../db/repositories')
const contractsProcessingPool = new TasksPool(CONTRACTS_PROCESSING)

Promise.all([
  repositories.connect(),
  contractsProcessingPool.connect()
])
  .then(([{
    AddressesRepository,
    InterfacesRepository,
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
          if (typeof transaction.from === 'object' && transaction.from.address) {
            // We'll do it only if sure
            if (transaction.from.type === 'contract') {
              contractAddresses.add(transaction.from.address)
            }
          } else {
            contractAddresses.add(transaction.from)
          }
          // to
          if (typeof transaction.to === 'object' && transaction.to.address) {
            // We'll do it only if sure
            if (transaction.to.type === 'contract') {
              contractAddresses.add(transaction.to.address)
            }
          } else {
            contractAddresses.add(transaction.to)
          }
          // logs addresses
          transaction.receipt.logs.forEach(log => {
            contractAddresses.add(log.address)
          })

          const processedAddresses = await contractsProcessing({
            addresses: Array.from(contractAddresses),
            blockNumber,
            createdAt,
            AddressesRepository
          })

          let decoratedTransaction = {}
          if (processedAddresses.length) {
            // re-decorate transaction
            decoratedTransaction = await transactionAfterSaveDecorator(transaction, InterfacesRepository, AddressesRepository)
          }
          transaction = Object.assign(transaction, decoratedTransaction, { isContractProcessed: true })
          // Save last transactions
          await TransactionsRepository.update(transaction, ['hash'])

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
