const log = require('debug')('ethereum')
const Parity = require('@parity/api')
const url = require('url')
const EventEmitter = require('events')
const util = require('util')
const exec = util.promisify(require('child_process').exec)

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
  /**
   * Conctructor of Ethereum
   * @param {String} path Path to ethereum node instance, can be http(s), ws, ipc interface
   */
  constructor(path) {
    super()
    const URL = url.parse(path)
    let provider
    switch (URL.protocol) {
      case 'http:':
      case 'https:':
        provider = new Parity.Provider.Http(URL.href)
        break

      case 'ws:':
        provider = new Parity.Provider.Ws(URL.href)
        break

      case 'ips:':
        provider = new Parity.Provider.Ipc(URL.path)
        break

      default:
        throw new Error('Unknown protocol')
    }

    this.patiry = new Parity(provider)
  }

  async subscribeOnNewBlocks(lastBlock = false) {
    if (!this.patiry) {
      throw new Error('Connection not ready')
    }

    // Need subscribe on new headers and headers and check block every new header
    if (!this.patiry.isPubSub) {
      log('Warning! This connection to ethererum node cannot use subscriptions. Emulation will used.')
    }
    // get subscription
    const subscription = await this.patiry.pubsub.eth.blockNumber((error, blockNumber) => {
      if (error) {
        throw new Error(error)
      }

      this.emit('blocks', {
        from: lastBlock !== false ? lastBlock : blockNumber,
        to: blockNumber
      })
      lastBlock = blockNumber
    })

    return subscription
  }

  /**
   * Return object with block and block transactions data
   * @param {Number} blockNumber
   * @return {Promise<Object>}
   */
  async getBlockData(blockNumber) {
    return new Promise(async (resolve) => {
      // Getting block and transactions data
      const block = await this.parity.eth.getBlock(blockNumber, true)
      if (block.extraData.length && block.extraData.startsWith('0x')) {
        block.extraData = Buffer.from(block.extraData.substring(block.extraData.indexOf('x') + 1), 'hex').toString()
      }
      const transactions = Array.from(block.transactions)
      let gottedReceipts = 0
      try {
        if (transactions.length) {
          // Getting operations data
          const batch = new this.parity.BatchRequest()
          transactions.forEach((transaction, index) => {
            batch.add(this.parity.eth.getTransactionReceipt.request(transaction.hash, (error, data) => {
              if (error) {
                throw new Error(error)
              }
              transactions[index].receipt = data
              gottedReceipts++
              if (gottedReceipts === transactions.length) {
                resolve({ block, transactions })
              }
            }))
          })
          batch.execute()
        } else {
          resolve({ block, transactions })
        }
      } catch (error) {
        log(error.toString())
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve(this.getBlockData(blockNumber)), 1000)
        })
      }
    })
  }

  /**
   * Return all balances of addresses
   * @param {Array} addresses
   * @return {Promise<Object>}
   */
  async getBalances(addresses) {
    return new Promise((resolve) => {
      const addressesBalances = []
      // Getting operations data
      const batch = new this.parity.BatchRequest()
      addresses = Array.from(new Set(addresses))
      addresses.forEach(address => {
        batch.add(this.parity.eth.getBalance.request(address, (error, data) => {
          if (error) {
            throw new Error(error)
          }
          addressesBalances.push({ address, balance: this.parity.utils.fromWei(data.toString(10), 'ether') })
          if (addressesBalances.length === addresses.length) {
            resolve(addressesBalances)
          }
        }))
      })
      batch.execute()
    })
  }

  /**
   * Load contract and return opcode
   * @param {String} address
   */
  async getContractOpcode(address) {
    try {
      const { stdout: opcode, stderr } = await exec(`myth -d -a "${address}" --rpc=${process.env.ETHEREUM_NODE_RPC}`)
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
    return new this.parity.eth.Contract(abi, contractAddress)
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
        const contract = new this.parity.eth.Contract(interfaceData.abi, address)
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
