require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions')
const TasksPool = require('../../../TasksPool')
const { SAVED_TRANSACTIONS_LISTNER } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const transactionAfterSaveDecorator = require('./decorators/transactionAfterSaveDecorator')
const addressDecorator = require('./decorators/addressDecorator')

const repositories = require('../../../db/repositories')

const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

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
        log(`[${hash}] Start processing transaction`)
        try {
          // Getting all block data for another process
          let [ transaction ] = await TransactionsRepository.find({ hash }).toArray()

          if (transaction) {
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
            transaction = Object.assign(transaction, decoratedTransaction, { processed: true })

            log(`[${hash}] Getting ETH balances`)
            // Update ethereum balance
            const ETHBalances = await ethereum.getBalances([transaction.from.address, transaction.to.address])
            let decoratedAddresses = []
            for (let b = 0; b < ETHBalances.length; b++) {
              decoratedAddresses.push(Object.assign(await addressDecorator(ETHBalances[b].address, AddressesRepository), { balance: ETHBalances[b].balance }))
            }

            // Get token balance
            log(`[${hash}] Getting tokens balances`)
            for (let i = 0; i < transaction.events.length; i++) {
              const event = transaction.events[i]
              if (
                event.name === 'Transfer' &&
                event.address.instanceOf.includes('ERC20Basic') &&
                typeof event.address.data.decimals !== 'undefined'
                ) {
                const contract = ethereum.getContract(event.address.address, event.address.instanceOf)
                const [ fromAddressBalance, toAddressBalance ] = await Promise.all([
                  contract.methods.balanceOf(event.data.from).call(),
                  contract.methods.balanceOf(event.data.to).call()
                ])
                const fromAddress = await addressDecorator(event.data.from, AddressesRepository)
                fromAddress.tokens = Object.assign(fromAddress.tokens, { [event.address.address]: (fromAddressBalance / (Math.pow(10, event.address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '') })
                decoratedAddresses.push(fromAddress)

                const toAddress = await addressDecorator(event.data.to, AddressesRepository)
                toAddress.tokens = Object.assign(toAddress.tokens, { [event.address.address]: (toAddressBalance / (Math.pow(10, event.address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '') })
                decoratedAddresses.push(toAddress)
              }
            }

            decoratedAddresses = decoratedAddresses.filter(address => +address.balance > 0)
            if (decoratedAddresses.length) {
              await AddressesRepository.update(decoratedAddresses, [ 'address' ], true)
              log(`[${hash}] Balances saved for addresses: ${decoratedAddresses.map(address => address.address).join(', ')}`)
            }

            // Save last transactions
            TransactionsRepository.update(transaction, ['hash'])
            log(`[${hash}] Done`)
          } else {
            log(`[${hash}] Not found. Transaction can be old`)
          }

          setImmediate(() => done())
        } catch (error) {
          log(`[${hash}] processing error`, error)
          process.exit()
        }
      })
  })
