require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER, CATCHING_UP_BLOCKS_LISTNER, CONTRACTS_PROCESSING, EVENTS_PROCESSING } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })
const transactionBeforeSaveDecorator = require('../../decorators/transactionBeforeSaveDecorator')
const transactionAfterSaveDecorator = require('../../decorators/transactionAfterSaveDecorator')
const addressDecorator = require('../../decorators/addressDecorator')
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

    const [ isBlockExist ] = await BlocksReposiroty.find({ number: blockNumber }).limit(1).toArray()

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
          }
        }

        // Getting balances
        // ----------------
        // Getting all ddresses from transactions
        const addressesForGetETHBalances = Array.from(new Set([].concat(...transactions.map(transaction => [transaction.from.address, transaction.to.address]))))

        let decoratedAddresses = []
        if (addressesForGetETHBalances.length > 0) {
          log(`[${blockNumber}] Getting ETH balances for ${addressesForGetETHBalances.length} addresses`)
          // Update ethereum balance
          const ETHBalances = await ethereum.getBalances(addressesForGetETHBalances)
          for (let b = 0; b < ETHBalances.length; b++) {
            decoratedAddresses.push(
              Object.assign(
                await addressDecorator(ETHBalances[b].address, AddressesRepository, false, true),
                { balance: ETHBalances[b].balance, updatedAt: new Date() }
              )
            )
          }
        }

        const contractAddressesForUpdate = {}
        const contracts = {}
        const allEventsOfBlock = [].concat(...transactions.map(transaction => transaction.events))

        for (let e = 0; e < allEventsOfBlock.length; e++) {
          const event = allEventsOfBlock[e]
          if (
            event.name === 'Transfer' &&
            event.address.instanceOf.includes('ERC20Basic') &&
            typeof event.address.data.decimals !== 'undefined'
          ) {
            if (typeof contractAddressesForUpdate[event.address.address] === 'undefined') {
              contractAddressesForUpdate[event.address.address] = new Set()
              contracts[event.address.address] = event.address
            }
            contractAddressesForUpdate[event.address.address].add(event.data.from.address)
            contractAddressesForUpdate[event.address.address].add(event.data.to.address)
          }
        }

        const promises = []
        const contractsAddresses = Object.keys(contractAddressesForUpdate)
        for (let c = 0; c < contractsAddresses.length; c++) {
          const contract = ethereum.getContract(contractsAddresses[c], contracts[contractsAddresses[c]].instanceOf)
          const addressesWithContract = Array.from(contractAddressesForUpdate[contractsAddresses[c]])
          for (let a = 0; a < addressesWithContract.length; a++) {
            const addressForUpdate = addressesWithContract[a]
            promises.push(
              new Promise((resolve, reject) => {
                log(`[${contractsAddresses[c]}] Get balance for address ${addressForUpdate}`)
                contract.methods.balanceOf(addressForUpdate).call()
                  .then(balance => addressDecorator(addressForUpdate, AddressesRepository, false, true).then(address => ({ address, balance })))
                  .then(({ address, balance }) => {
                    address.tokens = Object.assign(
                      address.tokens,
                      {
                        [contractsAddresses[c]]: {
                          address: contractsAddresses[c],
                          data: contracts[contractsAddresses[c]].data,
                          value: (balance / (Math.pow(10, contracts[contractsAddresses[c]].data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, ''),
                          updatedAt: new Date()
                        }
                      }
                    )
                    address.updatedAt = new Date()
                    log(address)
                    resolve(address)
                  }).catch(error => reject(error))
              }).catch(error => { log(`Error balance update for contract ${contractsAddresses[c]}`, error.toString()) })
            )
          }
        }

        // Getting tokens balances
        log(`[${blockNumber}] Getting tokens balances for ${promises.length} addresses`)
        const allPromisesData = await Promise.all(promises)
        const addressesFromEvents = allPromisesData.filter(address => address)
        if (addressesFromEvents.length) {
          decoratedAddresses.concat(addressesFromEvents)
        }

        log(`[${blockNumber}] Got balances for addresses ${decoratedAddresses.length}`)
        if (decoratedAddresses.length) {
          console.log(allPromisesData)
          await AddressesRepository.update(decoratedAddresses, [ 'address' ], true)
          log(`[${blockNumber}] Balances saved.`)
        }
        // END
        // -----------------

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
        await BlocksReposiroty.insert(block)

        log(`[${blockNumber}] Done (tx=${transactions.length})`)

        if (global.gc) {
          global.gc()
        }
        setImmediate(() => done())
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
