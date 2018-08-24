const log = require('debug')('ethereum')
const Web3 = require('web3')
const EventEmitter = require('events')
const exec = require('child_process')

const REQUEST_INTERVAL = 1000 // every second
const availableContractsInterfaces = require('./interfaces')

class Ethereum extends EventEmitter {
  constructor({ url = 'ws://localhost:8546', firstBlockNumber = 0 } = {}) {
    super()
    this.web3 = new Web3(url)
    this.tracingNewBlocks = false
    this.firstBlockNumber = firstBlockNumber
  }

  async traceNewBlocks() {
    // Start tracing
    this.web3.eth.getBlockNumber()
        .then(blockNumber => {
          if (this.firstBlockNumber < blockNumber) {
            const firstBlockNumber = this.firstBlockNumber
            this.firstBlockNumber = blockNumber
            setImmediate(() => this.emit('blocks', { from: firstBlockNumber, to: blockNumber }))
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
            transactions[index].receipt = data
            gottedReceipts++
          }))
        })
        batch.execute()
      }
    } catch (error) {
      log(error.toString())
      return new Promise((resolve, reject) => {
        setTimeout(() => resolve(this.getBlockData(blockNumber)), 1000)
      })
    }

    // Wait for batch is finish
    return new Promise((resolve, reject) => {
      function wait() {
        if (gottedReceipts < transactions.length) {
          setImmediate(() => wait())
        } else {
          resolve({ block, transactions })
        }
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
    addresses = Array.from(new Set(addresses))
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

  /**
   * Load contract and return opcode
   * @param {String} address
   */
  getContractOpcode(address) {
    return exec.execSync(`myth -d -a "${address}" --rpctls=${process.env.ETHEREUM_NODE_URL}`).toString()
  }

  getContractInterfaces(address) {
    const contractOpcode = this.getContractOpcode(address)

    // Check types
    return Object.keys(availableContractsInterfaces).filter(interfaceName => availableContractsInterfaces[interfaceName].every(hash => new RegExp(`\s*${hash}\s*`).test(contractOpcode)))
  }
}

module.exports = Ethereum
