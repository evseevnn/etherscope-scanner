require('dotenv').load()
const log = require('debug')('blockchain:ethereum:listners:blocks')
const TasksPool = require('../../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum()

const Graph = require('../../../graphdb')
const graph = new Graph()

// Nodes
const {
  Account, Transaction, Receipt,
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
    // Prepare promises
    const promises = []
    for (let current = from; current <= to; current++) {
      promises.push(new Promise(async (resolve, reject) => {
        const blockNumber = current
        log(`[#${blockNumber}] Start processing block`)
        try {
          // Make block from block data
          const { block: blockData, transactions, receipts } = await ethereum.getBlockData(blockNumber)
          const block = new Block(blockData)

          const transactionsPromises = []

          if (transactions.length) {
            // Get transactions accounts
            const accountsRefference = await getAccountsRefference(transactions)

            // Prepare transactions
            transactions.forEach(transactionRaw => {
              transactionsPromises.push(new Promise((resolve, reject) => {
                // Add transaction promise
                const transaction = new Transaction(transactionRaw)
                transaction.link('from', accountsRefference.get(transactionRaw.from), true)
                if (transaction.to) {
                  transaction.link('to', accountsRefference.get(transactionRaw.to), true)
                }
                let receiptRaw = receipts.find(receipt => receipt.transactionHash === transaction.hash)
                if (receiptRaw) {
                  resolve(new Promise((resolve, reject) => {
                    const receipt = new Receipt(receiptRaw)
                    receipt.link('block', block)
                    receipt.link('transaction', transaction)
                    if (receipt.contractAddress) {
                      ethereum.getTokenData(receiptRaw.contractAddress)
                        .then(erc20Data => {
                          let contract
                          if (erc20Data) {
                            log(`[ERC20][${erc20Data.address}] ${erc20Data.name} (${erc20Data.symbol})`)
                            contract = new ContractERC20(erc20Data)
                          } else {
                            contract = new Contract({ address: receiptRaw.contractAddress })
                          }
                          receipt.link('contract', contract, true)
                          contract.link('receipt', receipt)
                          if (receiptRaw.logs) {
                            receiptRaw.logs.forEach(log => {
                              log = new Log(log)
                              log.link('address', contract)
                              log.link('block', block)
                              log.link('transaction', transaction)
                              receipt.link('logs', log, true)
                            })
                          }
                          transaction.link('receipt', receipt, true)
                          resolve(transaction)
                        })
                        .catch(reject)
                    } else {
                      // add receipt to transaction
                      transaction.link('receipt', receipt, true)
                      resolve(transaction)
                    }
                  }))
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
      }))
    }

    eachPromises(promises, 10)
      .then(() => done())
      .catch(log)
  })

async function getAccountsRefference(transactions) {
  const allAddressesOfBlock = [...new Set(
    [].concat(...transactions.map(transaction => [transaction.from, transaction.to])
  ).filter(address => !!address))]

  // Getting accounts what already in graph
  const { accounts: accountsInGraph } = await graph.find(`
    query accounts($addresses: array) {
      accounts(func: eq(_type, "account")) @filter(eq(address, $addresses)) {
        uid
        address
      }
    }
  `, { $addresses: allAddressesOfBlock })

  // Getting array of new accounts
  const addressesOfNewAccounts = allAddressesOfBlock.filter(address => !accountsInGraph.find(account => account.address === address))

  // Getting balances of new accounts
  const balancesForNewAccounts = await ethereum.getBalances(addressesOfNewAccounts)

  // Generate accounts reference
  const accountsMap = new Map()
  // Add new accounts
  balancesForNewAccounts.forEach((balance, address) => {
    accountsMap.set(address, new Account({ address, balance }))
  })
  // Add exists accounts
  accountsInGraph.forEach(account => {
    accountsMap.set(account.address, new Account({ uid: account.uid }))
  })

  return accountsMap
}
