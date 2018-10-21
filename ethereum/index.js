const log = require('debug')('ethereum')
const Web3 = require('web3')
const EventEmitter = require('events')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

const RESUEST_PER_TIME = 30
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
  constructor({ url = 'ws://localhost:8546', firstBlockNumber = false } = {}) {
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
            const firstBlockNumber = this.firstBlockNumber && this.firstBlockNumber + 1
            this.firstBlockNumber = blockNumber
            setImmediate(() => this.emit('blocks', {
              from: (firstBlockNumber === false ? blockNumber : firstBlockNumber),
              to: blockNumber
            }))
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
    // let gottedReceipts = 0
    if (transactions.length) {
      // Getting operations data
      let lastIndex = 0
      let forRequest = transactions.slice(lastIndex, RESUEST_PER_TIME)
      const receipts = []
      while (forRequest.length > 0) {
        const promises = forRequest.map(transaction => this.web3.eth.getTransactionReceipt(transaction.hash))
        receipts.push(...await Promise.all(promises))
        for (let i = lastIndex; i < lastIndex + forRequest.length; i++) {
          transactions[i].receipt = receipts[i]
        }
        lastIndex += RESUEST_PER_TIME
        forRequest = transactions.slice(lastIndex, lastIndex + RESUEST_PER_TIME)
      }
    }
    return { block, transactions }
  }

  /**
   * Return all balances of addresses
   * @param {Array} addresses
   * @return {Promise<Object>}
   */
  async getBalances(addresses) {
    return new Promise(async (resolve) => {
      const addressesBalances = []

      // Getting operations data
      let lastIndex = 0
      let forRequest = addresses.slice(lastIndex, RESUEST_PER_TIME)
      const balances = []
      while (forRequest.length > 0) {
        const promises = forRequest.map(address => this.web3.eth.getBalance(address))
        balances.push(...await Promise.all(promises))
        for (let i = lastIndex; i < lastIndex + forRequest.length; i++) {
          addressesBalances.push({ address: addresses[i], balance: this.web3.utils.fromWei(balances[i].toString(10), 'ether') })
        }
        lastIndex += RESUEST_PER_TIME
        forRequest = addresses.slice(lastIndex, lastIndex + RESUEST_PER_TIME)
      }

      resolve(addressesBalances)
      // Getting operations data
      // const batch = new this.web3.BatchRequest()
      // addresses = Array.from(new Set(addresses))
      // addresses.forEach(address => {
      //   batch.add(this.web3.eth.getBalance.request(address, (error, data) => {
      //     if (error) {
      //       throw new Error(error)
      //     }
      //     addressesBalances.push({ address, balance:  })
      //     if (addressesBalances.length === addresses.length) {
      //       resolve(addressesBalances)
      //     }
      //   }))
      // })
      // batch.execute()
    })
  }

  /**
   * Load contract and return opcode
   * @param {String} address
   */
  async getContractOpcode(address) {
    try {
      const { stdout: opcode, stderr } = await exec(`myth -d -a "${address}" --rpc=${process.env.ETHEREUM_NODE_RPC}`, { maxBuffer: 1024 * 1024 })
      if (stderr) {
        throw Error(`Error getting opcode for address ${address}`)
      }
      if (opcode.startsWith('Received an empty response')) {
        log(`Address ${address} is not a contract`)
        return null
      }
      return opcode
    } catch (error) {
      log(error.toString())
      return null
    }
  }

  /**
   * Return contract interfaces
   * @param {String} address
   */
  async getContractInterfaces(address, opcode) {
    if (!opcode) {
      opcode = await this.getContractOpcode(address)
    }

    // Check types
    return Object.keys(contractsFuncHashes).filter(interfaceName => {
      return contractsFuncHashes[interfaceName].every(hash => {
        return new RegExp(hash).test(opcode)
      })
    })
  }

  /**
   * return contract instance
   * @param {String} contractAddress
   * @param {Array} interfaces
   */
  getContract(contractAddress, interfaces) {
    let abi = []
    interfaces.forEach(interfaceName => {
      if (!contractsInterfaces[interfaceName]) {
        log(`Interface with name ${interfaceName} is not found`)
      } else {
        abi = abi.concat(contractsInterfaces[interfaceName].abi)
      }
    })
    return new this.web3.eth.Contract(abi, contractAddress)
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
