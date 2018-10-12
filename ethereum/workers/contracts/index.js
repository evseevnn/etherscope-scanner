require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { CONTRACTS_PROCESSING } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')

const repositories = require('../../../db/repositories')

repositories
  .connect()
  .then(({
    AddressesRepository,
    InterfacesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(CONTRACTS_PROCESSING)
      .connectAsReader('processing', async ({ hash }, done) => {
        log(`[${hash}] Start processing transaction`)
        try {
          // Getting all block data for another process
          let [ transaction ] = await TransactionsRepository.find({ hash, processed: { $ne: true } }).toArray()

          if (transaction) {
            // Contract processing
            const contractAddresses = new Set()
            if (transaction.receipt.contractAddress) {
              contractAddresses.add(transaction.receipt.contractAddress)
            }
            // from
            if (typeof transaction.from === 'object' && transaction.from.address) {
              contractAddresses.add(transaction.from.address)
            } else {
              contractAddresses.add(transaction.from)
            }
            // to
            if (typeof transaction.to === 'object' && transaction.to.address) {
              contractAddresses.add(transaction.to.address)
            } else {
              contractAddresses.add(transaction.to)
            }
            // logs addresses
            transaction.receipt.logs.forEach(log => {
              contractAddresses.add(log.address)
            })

            log(`[${transaction.hash}] Addresses for checking: `, Array.from(contractAddresses))
            await contractsProcessing({ addresses: Array.from(contractAddresses), AddressesRepository })

            // re-decorate transaction
            const decoratedTransaction = await transactionAfterSaveDecorator(transaction, InterfacesRepository, AddressesRepository)
            transaction = Object.assign(transaction, decoratedTransaction, { processed: true })
            // Save last transactions
            TransactionsRepository.update(transaction, ['hash'])
            log(`[${hash}] Done`)
          } else {
            log(`[${hash}] Not found. Transaction can be processed already`)
          }

          done()
        } catch (error) {
          log(`[${hash}] processing error`, error)
          process.exit()
        }
      })
  })
