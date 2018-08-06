const log = require('debug')('blockchain:ethereum')
const Web3 = require('web3')
const EventEmitter = require('events')

const REQUEST_INTERVAL = 1000 // every second

class Ethereum extends EventEmitter {
  constructor({ url } = { url: process.env.ETHEREUM_NODE_URL }) {
    super()
    this.web3 = new Web3(url)
    this.tracingNewBlocks = false
    this.lastBlockNumber = +process.env.LAST_BLOCK_NUMBER || 0
  }

  async traceNewBlocks() {
    // Start tracing
    this.web3.eth.getBlockNumber()
        .then(blockNumber => {
          if (this.lastBlockNumber < blockNumber) {
            const lastLastBlockNumber = this.lastBlockNumber
            this.lastBlockNumber = blockNumber
            setImmediate(() => this.emit('blocks', { from: lastLastBlockNumber, to: blockNumber }))
          }
          setTimeout(() => this.traceNewBlocks(), REQUEST_INTERVAL)
        })
        .catch(log)
  }

  /**
   * Return object with block and block transactions data
   * @param {Number} blockNumber
   * @return {Promise<Object>}
   */
  async getBlockData(blockNumber) {
    // Getting block and transactions data
    const blockData = await this.web3.eth.getBlock(blockNumber, true)
    const block = blockData
    const transactions = Array.from(block.transactions)
    let gottedReceipts = 0
    try {
      if (transactions.length) {
        // Getting operations data
        const batch = new this.web3.BatchRequest()
        transactions.forEach((transaction, index) => {
          batch.add(this.web3.eth.getTransactionReceipt.request(transaction.hash, (error, data) => {
            if (error) {
              throw new Error(error)
            }
            Object.assign(transactions[index], data || {})
            gottedReceipts++
          }))
        })
        batch.execute()
      }
    } catch (error) {
      log(error.toString())
      setTimeout(() => this.getBlockData(blockNumber), 1000)
    }

    // Wait for batch is finish
    return new Promise((resolve, reject) => {
      function wait() {
        setImmediate(() => {
          if (gottedReceipts < transactions.length) {
            wait()
          } else {
            resolve({ block, transactions })
          }
        })
      }

      wait()
    })
  }

  /**
   * Return all balances of addresses
   * @param {Array} addresses
   * @return {Promise<Map>}
   */
  async getBalances(addresses) {
    const addressesBalances = new Map()
    // Getting operations data
    const batch = new this.web3.BatchRequest()
    addresses.forEach(address => {
      batch.add(this.web3.eth.getBalance.request(address, (error, data) => {
        if (error) {
          throw new Error(error)
        }
        addressesBalances.set(address, data)
      }))
    })
    batch.execute()

    // Wait for batch is finish
    return new Promise((resolve, reject) => {
      function wait() {
        setImmediate(() => {
          if (addressesBalances.size < addresses.length) {
            wait()
          } else {
            resolve(addressesBalances)
          }
        })
      }

      wait()
    })
  }
}

module.exports = Ethereum
