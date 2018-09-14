const log = require('debug')('ethereum')
const Web3 = require('web3')
const EventEmitter = require('events')
const exec = require('child_process')

const REQUEST_INTERVAL = 1000 // every second
const contractsInterfaces = require('./interfaces')
const contractsFuncHashes = {}
Object.keys(contractsInterfaces).forEach(interfaceName => {
  const abiEntities = contractsInterfaces[interfaceName].abi
  const hashes = []
  abiEntities.forEach(abiEntity => {
    if (
      abiEntity.name &&
      abiEntity.type === 'function'
    ) {
      hashes.push(abiEntity._hash)
    }
  })
  if (hashes.length) {
    contractsFuncHashes[interfaceName] = hashes
  }
})

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
    const block = await this.web3.eth.getBlock(blockNumber, true)
    if (block.extraData.length && block.extraData.startsWith('0x')) {
      block.extraData = Buffer.from(block.extraData.substring(block.extraData.indexOf('x') + 1), 'hex').toString()
    }
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
    try {
      return exec.execSync(`myth -d -a "${address}" --rpc=${process.env.ETHEREUM_NODE_RPC}`).toString()
    } catch (error) {
      log(error.toString())
      return null
    }
  }

  /**
   * Return contract interfaces
   * @param {String} address
   */
  getContractInterfaces(address, opcode) {
    if (!opcode) {
      opcode = this.getContractOpcode(address)
    }

    // Check types
    return Object.keys(contractsFuncHashes).filter(interfaceName => {
      const result = contractsFuncHashes[interfaceName].every(hash => {
        return new RegExp(hash).test(opcode)
      })
      return result
    })
  }

  /**
   * Return data from contract using interfaces
   * @param {String} address
   * @param {Array<String>} interfaces
   */
  async getContractDataByInterfaces(address, interfaces) {
    const contractData = {}
    const promises = []
    interfaces.forEach(interfaceName => {
      if (!contractsInterfaces[interfaceName]) {
        log(`Interface with name ${interfaceName} is not found`)
      } else {
        const interfaceData = contractsInterfaces[interfaceName]
        const contract = new this.web3.eth.Contract(interfaceData.abi, address)
        interfaceData.abi.forEach(abiEntity => {
          if (
            abiEntity.name &&
            !abiEntity.inputs.length &&
            abiEntity.type === 'function' &&
            (abiEntity.constant || abiEntity.stateMutability === 'view')
          ) {
            promises.push(contract.methods[abiEntity.name]().call().then(value => (contractData[abiEntity.name] = value)).catch(() => log(`[${address}][${abiEntity.name}] Cannot get contract data from method`)))
          }
        })
      }
    })
    return Promise.all(promises)
      .then(() => contractData)
      .catch(error => {
        log(`[${address}] Cannot get contract data`, error.toString())
      })
  }
}

module.exports = Ethereum
