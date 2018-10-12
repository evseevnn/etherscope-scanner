require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { BALANCES_PROCESSING } = require('..')
const addressDecorator = require('../../decorators/addressDecorator')

const repositories = require('../../../db/repositories')

const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

repositories
  .connect()
  .then(({
    AddressesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(BALANCES_PROCESSING)
      .connectAsReader('processing', async ({ hash }, done) => {
        // Getting all block data for another process
        let [ transaction ] = await TransactionsRepository.find({ hash, isContractProcessed: true }).toArray()

        if (transaction) {
          // Balances processing
          log('Getting addresses for update ETH balance')
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

          transaction.isBalancesUpdated = true
          if (decoratedAddresses.length) {
            await Promise.all([
              AddressesRepository.update(decoratedAddresses, [ 'address' ], true),
              TransactionsRepository.update(transaction, ['hash'])
            ])
            await AddressesRepository.update(decoratedAddresses, [ 'address' ], true)
            log(`[${hash}] Balances saved for addresses: ${decoratedAddresses.map(address => address.address).join(', ')}`)
          } else {
            await TransactionsRepository.update(transaction, ['hash'])
          }
        } else {
          log(`Transaction ${hash} not found`)
        }

        done()
      })
  })
