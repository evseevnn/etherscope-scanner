require('dotenv').load()
const log = require('debug')('ethereum:listners:transactions-processing')
const TasksPool = require('../../../TasksPool')
const { EVENTS_PROCESSING } = require('..')
const addressDecorator = require('../../decorators/addressDecorator')

const repositories = require('../../../db/repositories')

const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

if (global.gc) {
  setInterval(() => global.gc(), 5000)
}

repositories
  .connect()
  .then(({
    AddressesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(EVENTS_PROCESSING)
      .connectAsReader('balances-processing', async ({ hash }, done) => {
        // Getting all block data for another process
        let [ transaction ] = await TransactionsRepository.find({ hash }).toArray()

        if (transaction) {
          try {
            // Balances processing
            log('Getting addresses for update ETH balance')
            // Check addresses for update ETH balance
            const query = { address: { $in: [transaction.from.address, transaction.to.address] }, updatedAt: { $gt: transaction.createdAt } }
            if (process.env.BALANCE_FETCH_FORCE) {
              delete query.updatedAt
            }
            const noNeedForCheckAddresses = (await AddressesRepository.find(query).toArray()).map(address => address.address)
            let decoratedAddresses = []
            const addressesForCheckEthBalance = [transaction.from.address, transaction.to.address].filter(address => !noNeedForCheckAddresses.includes(address))
            if (addressesForCheckEthBalance) {
              log(`[${hash}] Getting ETH balances`)
              // Update ethereum balance
              const ETHBalances = await ethereum.getBalances(addressesForCheckEthBalance)
              for (let b = 0; b < ETHBalances.length; b++) {
                decoratedAddresses.push(
                  Object.assign(
                    await addressDecorator(ETHBalances[b].address, AddressesRepository, false, true),
                    { balance: ETHBalances[b].balance, updatedAt: new Date() }
                  )
                )
              }
            }

            // Getting addresses from events
            let addressesForCheckTokensBalance = new Set()
            for (let i = 0; i < transaction.events.length; i++) {
              const event = transaction.events[i]
              if (
                event.name === 'Transfer' &&
                event.address.instanceOf.includes('ERC20Basic') &&
                typeof event.address.data.decimals !== 'undefined'
              ) {
                addressesForCheckTokensBalance.add(event.data.from.address)
                addressesForCheckTokensBalance.add(event.data.to.address)
              }
            }

            // Get token balance
            const checkedAddresses = new Set()
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
                if (!checkedAddresses.has(event.address.address + event.data.from.address)) {
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
                  checkedAddresses.add(event.address.address + event.data.from.address)
                }
                if (!checkedAddresses.has(event.address.address + event.data.to.address)) {
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
                  checkedAddresses.add(event.address.address + event.data.to.address)
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
                TransactionsRepository.update(transaction, [ 'hash' ])
              ])
              log(`[${hash}] Balances saved for addresses: ${decoratedAddresses.map(address => address.address).join(', ')}`)
            } else {
              await TransactionsRepository.update(transaction, ['hash'])
            }
          } catch (error) {
            log(error)
            process.exit()
          }
        } else {
          log(`Transaction ${hash} not found`)
        }

        done()
      })
  })
