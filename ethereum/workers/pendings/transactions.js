require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { PENDING_TRANSACTIONS_LISTNER, CONTRACTS_PROCESSING } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })
const transactionBeforeSaveDecorator = require('../../decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const repositories = require('../../../db/repositories')

const transactionsPool = new TasksPool(CONTRACTS_PROCESSING)

Promise.all([
  repositories.connect(),
  transactionsPool.connectAsWriter()
])
.then(([{
  AddressesRepository,
  InterfacesRepository,
  TransactionsRepository
}]) => {
  new TasksPool(PENDING_TRANSACTIONS_LISTNER)
  .connectAsReader('pending-transactions-processing', async ({ hash }, done) => {
    log(`[#${hash}] Start processing`)

    try {
      // Getting all block data
      log(`[#${hash}] Getting transaction data`)
      let transaction = await ethereum.web3.eth.getTransaction(hash)
      log(`[#${hash}] Prepare and save`)

      if (transaction) {
        // Decorate transaction
        const decoratedBeforeTransaction = await transactionBeforeSaveDecorator(transaction, AddressesRepository)
        const decoratedAfterTransaction = await transactionAfterSaveDecorator(transaction, InterfacesRepository, AddressesRepository, true)
        transaction = Object.assign(
            transaction,
            decoratedBeforeTransaction,
            decoratedAfterTransaction
          )

        // Save last transactions
        await TransactionsRepository.update(transaction, ['hash'], true)
      }

      log(`[#${hash}] Done`)
      setImmediate(() => done())
    } catch (error) {
      log(`[#${hash}] processing error`, error)
      process.exit()
    }
  })
})
