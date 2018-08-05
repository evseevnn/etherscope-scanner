require('dotenv').load()
const log = require('debug')('blockchain:ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum()

const Graph = require('../../../graphdb')
const graph = new Graph()

const BLOCKS_PER_TIME = 10

// Nodes
const {
  Account, Transaction,
  Block, Contract, ContractERC20, Log
} = require('../../../graphdb/models').ethereum

async function eachPromises(promises, perTime = 10, result = []) {
  const promisesForNow = promises.splice(0, perTime)
  if (promisesForNow.length) {
    const data = await Promise.all(promisesForNow)
    return eachPromises(promises, perTime, result.concat(data))
  }
  return result
}

new TasksPool(NEW_BLOCKS_LISTNER)
  .connectAsReader(async ({ from, to }, done) => {
    function saveBlock(blockNumber) {
      return new Promise(async (resolve, reject) => {
        log(`[#${blockNumber}] Start processing block`)

        try {
          // Make block from block data
          const { block: blockData, transactions } = await ethereum.getBlockData(blockNumber)
          const block = new Block(blockData)

          const transactionsPromises = []

          if (transactions.length) {
            // Get transactions accounts
            const allAddressesOfBlock = [...new Set(
              [].concat(...transactions.map(transaction => {
                const result = []
                if (transaction.from) {
                  result.push(transaction.from)
                }
                if (transaction.to) {
                  result.push(transaction.to)
                }
                return result
              })
            ))]

            const accountsRefference = await getAccounts(allAddressesOfBlock)

            // Prepare transactions
            transactions.forEach(transactionRaw => {
              transactionsPromises.push(new Promise((resolve, reject) => {
                // Add transaction promise
                const transaction = new Transaction(transactionRaw)
                transaction.link('from', accountsRefference.get(transactionRaw.from), true)
                if (transactionRaw.to) {
                  transaction.link('to', accountsRefference.get(transactionRaw.to), true)
                }

                // Collect logs
                if (transactionRaw.logs) {
                  transactionRaw.logs.forEach(log => transaction.link('logs', new Log(log), true))
                }

                // Collect contracts
                if (transaction.contractAddress) {
                  ethereum.getTokenData(transaction.contractAddress)
                    .then(erc20Data => {
                      let contract
                      if (erc20Data) {
                        log(`[ERC20][${erc20Data.address}] ${erc20Data.name} (${erc20Data.symbol})`)
                        contract = new ContractERC20(erc20Data)
                      } else {
                        contract = new Contract({ address: transaction.contractAddress })
                      }
                      transaction.link('contract', contract, true)
                      resolve(transaction)
                    })
                    .catch(reject)
                } else {
                  resolve(transaction)
                }
              }))
            })
          }

          // resolve all promises of transactions
          eachPromises(transactionsPromises, 10)
            .then(async transactions => {
              if (transactions.length) {
                transactions.forEach(transaction => block.link('transactions', transaction, true))
              }
              // Save to graph
              await graph.insert(block)
              log(`[#${blockNumber}] Done (tx=${transactions.length})`)
              resolve()
            })
            .catch(reject)
        } catch (error) {
          log(`[#${blockNumber}] processing error`)
          reject(error)
        }
      })
    }

    function processing() {
      // Prepare promises
      const promises = []
      for (let i = 0; i < BLOCKS_PER_TIME; i++) {
        if (from + i > to) {
          break
        }
        promises.push(saveBlock(from + i))
      }
      from = from + BLOCKS_PER_TIME

      Promise.all(promises)
        .then(() => {
          if (from < to) {
            process.nextTick(() => processing())
          } else {
            done()
          }
        })
        .catch(log)
    }

    processing()
  })

async function getAccounts(allAddressesOfBlock) {
  // Getting accounts what already in graph
  const { accounts: accountsInGraph } = await graph.find(`
    query accounts($addresses: array) {
      accounts(func: eq(_type, "account")) @filter(eq(address, $addresses)) {
        uid
        address
      }
    }
  `, { $addresses: allAddressesOfBlock })

  // Getting balances of new accounts
  const balancesForNewAccounts = await ethereum.getBalances(allAddressesOfBlock)

  // Generate accounts reference
  const accountsMap = new Map()

  // Add new accounts
  balancesForNewAccounts.forEach((balance, address) => {
    const account = new Account({ address, balance })
    const accountFromGraph = accountsInGraph.find(accountInGraph => accountInGraph.address === account.address)
    if (accountFromGraph) {
      account.uid = accountFromGraph.uid
    }
    accountsMap.set(address, account)
  })

  return accountsMap
}
