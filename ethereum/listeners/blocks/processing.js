require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions')
const TasksPool = require('../../../TasksPool')
const { SAVED_TRANSACTIONS_LISTNER } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const transactionAfterSaveDecorator = require('./decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')

// @FIXIT: PLS
// Exit after 1 hours of work.
// Need for temporary fix problem with memory overflow
// PM2 will start process again
setTimeout(() => {
  process.exit(0)
}, 1 * 60 * 60 * 1000)

repositories
  .connect()
  .then(({
    AddressesRepository,
    InterfacesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(SAVED_TRANSACTIONS_LISTNER)
      .connectAsReader('processing', async ({ hash }, done) => {
        log(`[#${hash}] Start processing transaction for getting contracts`)
        try {
          // Getting all block data for another process
          log(`[#${hash}] Getting transaction`)
          let [ transaction ] = await TransactionsRepository.find({ hash }).toArray()
          log(`[#${hash}] Processing for get contracts`)

          // Contract processing
          const contractAddresses = new Set()
          if (transaction.receipt) {
            if (transaction.receipt.contractAddress) {
              contractAddresses.add(transaction.receipt.contractAddress)
            }

            if (transaction.receipt.logs && transaction.receipt.logs.length) {
              if (typeof transaction.to === 'object' && transaction.to.address) {
                contractAddresses.add(transaction.to.address)
              } else {
                contractAddresses.add(transaction.to)
              }
              transaction.receipt.logs.forEach(log => contractAddresses.add(log.address))
            }
          }

          await contractsProcessing({ addresses: Array.from(contractAddresses), AddressesRepository })

          // re-decorate transaction
          const decoratedTransaction = await transactionAfterSaveDecorator(transaction, InterfacesRepository, AddressesRepository)
          transaction = Object.assign(transaction, decoratedTransaction)

          // Save last transactions
          TransactionsRepository.update(transaction, ['hash'])

          log(`[#${hash}] Done`)
          setImmediate(() => done())
        } catch (error) {
          log(`[#${hash}] processing error`, error)
          process.exit()
        }
      })
  })
