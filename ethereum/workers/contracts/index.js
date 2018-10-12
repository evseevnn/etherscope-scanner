require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { CONTRACTS_PROCESSING } = require('..')
const contractsProcessing = require('./modules/contractsProcessing')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const addressDecorator = require('../../decorators/addressDecorator')

const repositories = require('../../../db/repositories')

const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

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

            log(`[${transaction.hash}] Addresses for checking: `, Array.from(contractAddresses))
            await contractsProcessing({ addresses: Array.from(contractAddresses), AddressesRepository })

            // re-decorate transaction
            const decoratedTransaction = await transactionAfterSaveDecorator(transaction, InterfacesRepository, AddressesRepository)
            transaction = Object.assign(transaction, decoratedTransaction, { processed: true })
            // Save last transactions
            TransactionsRepository.update(transaction, ['hash'])

            // Balances processing
            log('Update balances')
            // Check addresses for update ETH balance
            const addressesForCheckEthBalance = (await AddressesRepository.find({ addresses: { $in: [transaction.from.address, transaction.to.address] }, updatedAt: { $lt: transaction.createdAt } }).toArray()).map(address => address.address)
            let decoratedAddresses = []
            if (addressesForCheckEthBalance) {
              log(`[${hash}] Getting ETH balances`)
              // Update ethereum balance
              const ETHBalances = await ethereum.getBalances([transaction.from.address, transaction.to.address])
              for (let b = 0; b < ETHBalances.length; b++) {
                decoratedAddresses.push(Object.assign(await addressDecorator(ETHBalances[b].address, AddressesRepository, false, true), { balance: ETHBalances[b].balance, updatedAt: new Date() }))
              }
            }

            // Getting addresses from events
            let addressesForCheckTokensBalance = new Set()
            const contractAddressesList = {}
            const $or = []
            for (let i = 0; i < transaction.events.length; i++) {
              const event = transaction.events[i]
              if (
                event.name === 'Transfer' &&
                event.address.instanceOf.includes('ERC20Basic') &&
                typeof event.address.data.decimals !== 'undefined'
              ) {
                addressesForCheckTokensBalance.add(event.data.from.address)
                addressesForCheckTokensBalance.add(event.data.to.address)

                $or.push({ [`tokens.${event.address.address}.updatedAt`]: { $lt: transaction.createdAt } })

                if (!contractAddressesList[event.address.address]) {
                  contractAddressesList[event.address.address] = new Set([event.data.from.address, event.data.to.address])
                } else {
                  contractAddressesList[event.address.address].add(event.data.from.address)
                  contractAddressesList[event.address.address].add(event.data.to.address)
                }
              }
            }

            let addressesForUpdateTokensBalanceExistsList = []
            addressesForCheckTokensBalance = Array.from(addressesForCheckTokensBalance)
            if (addressesForCheckTokensBalance.length) {
              addressesForUpdateTokensBalanceExistsList = (await AddressesRepository.find({ addresses: { $in: addressesForCheckTokensBalance }, $or }).toArray()).map(address => address.address)
            }

            // Get token balance
            log(`[${hash}] Getting tokens balances`)
            const promises = []
            for (let i = 0; i < transaction.events.length; i++) {
              const event = transaction.events[i]
              if (
                event.name === 'Transfer' &&
                event.address.instanceOf.includes('ERC20Basic') &&
                typeof event.address.data.decimals !== 'undefined'
                ) {
                const contract = ethereum.getContract(event.address.address, event.address.instanceOf)
                if (addressesForUpdateTokensBalanceExistsList.includes(event.data.from.address)) {
                  promises.push(
                    contract.methods.balanceOf(event.data.from.address).call()
                      .then(async balance => {
                        const address = await addressDecorator(event.data.from, AddressesRepository, false, true)
                        address.tokens = Object.assign(
                          address.tokens,
                          {
                            [event.address.address]: {
                              address: event.address.address,
                              data: event.address.data,
                              value: (balance / (Math.pow(10, event.address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, ''),
                              updatedAt: new Date()
                            }
                          }
                        )
                        address.updatedAt = new Date()
                        return address
                      })
                  )
                }
                if (addressesForUpdateTokensBalanceExistsList.includes(event.data.to.address)) {
                  promises.push(
                    contract.methods.balanceOf(event.data.to.address).call()
                      .then(async balance => {
                        const address = await addressDecorator(event.data.from, AddressesRepository, false, true)
                        address.tokens = Object.assign(
                          address.tokens,
                          {
                            [event.address.address]: {
                              address: event.address.address,
                              data: event.address.data,
                              value: (balance / (Math.pow(10, event.address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, ''),
                              updatedAt: new Date()
                            }
                          }
                        )
                        address.updatedAt = new Date()
                        return address
                      })
                  )
                }
              }
            }

            const addressesFromEvents = await Promise.all(promises)
            if (addressesFromEvents.length) {
              decoratedAddresses.concat(addressesFromEvents)
            }
            if (decoratedAddresses.length) {
              await AddressesRepository.update(decoratedAddresses, [ 'address' ], true)
              log(`[${hash}] Balances saved for addresses: ${decoratedAddresses.map(address => address.address).join(', ')}`)
            }




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
