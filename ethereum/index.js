const log = require('debug')('ethereum')
const Parity = require('@parity/api')
const url = require('url')
const EventEmitter = require('events')

const { interfacesFunctions, abi: contractsHashAbi } = require('./interfaces')

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

    this.parity = new Parity(provider)
  }

  async subscribeOnNewBlocks(lastBlock = null) {
    if (!this.parity) {
      throw new Error('Connection not ready')
    }

    // Need subscribe on new headers and headers and check block every new header
    if (!this.parity.isPubSub) {
      throw new Error('Warning! This connection to ethererum node cannot use subscriptions.')
    }

    // get subscription
    const subscription = await this.parity.pubsub.eth.blockNumber((error, blockNumber) => {
      if (error) {
        throw new Error(error)
      }

      this.emit('blocks', {
        from: lastBlock !== null ? lastBlock + 1 : blockNumber.toNumber(),
        to: blockNumber.toNumber()
      })
      lastBlock = blockNumber.toNumber()
    })

    return subscription
  }

  /**
   * Return object with block and block transactions data
   * @param {Number} blockNumber
   * @return {Promise<Object>}
   */
  async getBlockData(blockNumber) {
    if (!this.parity) {
      throw new Error('Connection not ready')
    }

    let parity = this.parity

    let [ block, receipts ] = await Promise.all([
      parity.eth.getBlockByNumber(blockNumber, true),
      parity.parity.getBlockReceipts(blockNumber)
    ])

    if (block.extraData && block.extraData.length && block.extraData.startsWith('0x')) {
      block.extraData = Buffer.from(block.extraData.substring(block.extraData.indexOf('x') + 1), 'hex').toString()
    }

    const transactions = Array.from(block.transactions).map((transaction, index) => {
      transaction.receipt = receipts[index]
      return transaction
    })

    return {
      block: JSON.parse(JSON.stringify(block)),
      transactions: JSON.parse(JSON.stringify(transactions))
    }
  }

  /**
   * Return balance of address
   * @param {String} address
   * @param {Any} blockNumber
   * @return {Promise<Object>}
   */
  async getBalance(address, blockNumber = 'latest') {
    const balance = await this.parity.eth.getBalance(address, blockNumber)
    return balance
  }

  /**
   * Load contract and return code
   * @param {String} address
   */
  async getContractCode(address) {
    const code = await this.parity.eth.getCode(address)
    return code
  }

  /**
   * Return contract interfaces
   * @param {String} address
   */
  async getContractInterfaces(address, code) {
    if (!code) {
      code = await this.getContractCode(address)
    }

    // Getting abi
    const abi = Object.keys(contractsHashAbi)
      .filter(hash => code.includes(hash))
      .map(hash => contractsHashAbi[hash])

    // Check types
    const instanceOf = Object.keys(interfacesFunctions).filter(interfaceName => {
      return interfacesFunctions[interfaceName].every(hash => {
        return new RegExp(hash).test(code)
      })
    })

    return { abi, instanceOf }
  }

  /**
   * return contract instance
   * @param {String} contractAddress
   * @param {Array} interfaces
   */
  getContract(contractAddress, abi) {
    return this.parity.newContract(abi, contractAddress)
  }

  /**
   * Return data from contract using interfaces
   * @param {String} address
   * @param {Array<String>} abi
   */
  async getContractDataByInterfaces(address, abi) {
    const contractData = {}
    const promises = []
    const contract = this.parity.newContract(abi, address)
    abi.forEach(abiEntity => {
      if (
        abiEntity.name &&
        !abiEntity.inputs.length &&
        abiEntity.type === 'function' &&
        (abiEntity.constant || abiEntity.stateMutability === 'view')
      ) {
        promises
          .push(
            contract.instance[abiEntity.name]
              .call()
              .then(value => {
                contractData[abiEntity.name] = value.toString()
              })
              .catch(() => log(`[${address}][${abiEntity.name}] Cannot get contract data from method`))
          )
      }
    })
    return Promise.all(promises)
      .then(() => {
        return JSON.parse(JSON.stringify(contractData))
      })
      .catch(error => {
        log(`[${address}] Cannot get contract data`, error.toString())
      })
  }
}

module.exports = Ethereum
