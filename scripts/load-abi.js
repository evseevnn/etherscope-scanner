require('dotenv').load()
const log = require('debug')('scripts:load-abi')
const etherscanAPI = require('etherscan-api').init(process.env.ETHERSCAN_API_KEY)
const repositories = require('../db/repositories')
const Ethereum = require('../blockchain/ethereum')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_URL })

async function getABIData(address, abi) {
  if (!Array.isArray(abi)) {
    log('ABI: ', abi)
    throw new Error(`Cannot read abi data`)
  }

  // Prepare abi output for broken contracts data
  abi = abi.map(abiMethod => {
    return abiMethod.outputs
      ? Object.assign(abiMethod, {
        outputs: abiMethod.outputs.map(item => {
          let defaultValue
          switch (true) {
            case ['bool'].includes(item.type):
              defaultValue = false
              break

            case ['string'].includes(item.type):
              defaultValue = ''
              break

            case item.type.startsWith('fixed'):
            case item.type.startsWith('ufixed'):
            case item.type.startsWith('uint'):
            case item.type.startsWith('int'):
              defaultValue = 0
              break

            case item.type.startsWith('address'):
              defaultValue = '0x'
              break

            case item.type.startsWith('bytes'):
              defaultValue = null
              break

            default:
              defaultValue = null
          }
          return Object.assign(item, { value: defaultValue })
        })
      })
      : abiMethod
  })

  const contract = new ethereum.web3.eth.Contract(abi, address)
  const abiData = { constants: {}, methods: {}, payableMethods: [] }
  const promises = []
  abi.forEach(abiMethod => {
    if (abiMethod.name) {
      promises.push(new Promise((resolve, reject) => {
        if (abiMethod.constant && !abiMethod.inputs.length) {
          contract.methods[abiMethod.signature]().call()
            .then(value => (abiData.constants[abiMethod.name] = value))
            .then(resolve)
            .catch(error => {
              log(`[${address}] ABI is not correct`)
              reject(error.toString())
            })
        } else {
          const method = `${abiMethod.name}(${abiMethod.inputs.map(input => input.type).join(',')})`
          abiData.methods[abiMethod.signature] = method
          if (abiMethod.payable) {
            abiData.payableMethods.push(abiMethod.signature)
          }
          resolve()
        }
      }))
    }
  })

  return Promise.all(promises).then(() => abiData).catch(log)
}

repositories
  .connect()
  .then(async ({ AddressesRepository }) => {
    // Get contracts addresses without abi
    const contracts = await AddressesRepository.find({ type: AddressesRepository.ADDRESS_TYPE_CONTRACT, abi: { $exists: false } }).addCursorFlag('noCursorTimeout', true)
    async function processing() {
      setTimeout(() => {
        contracts.next(async (error, contract) => {
          if (error) {
            throw new Error(error)
          }
          if (contract) {
            // trying get abi
            log(`[${contract.address}] Trying get ABI`)
            try {
              const { result: abi } = await etherscanAPI.contract.getabi(contract.address)
              // save to database
              if (abi) {
                try {
                  contract.abi = JSON.parse(abi)
                  const abiData = await getABIData(contract.address, contract.abi)
                  Object.assign(contract, abiData)
                } catch (e) {
                  log(`[${contract.address}] Broken ABI`, e)
                  processing()
                  return
                }
                await AddressesRepository.upsert(contract)
                log(`[${contract.address}] ABI Saved`)
                processing()
              } else {
                log(`[${contract.address}] ABI Not Found`)
                processing()
              }
            } catch (error) {
              log(`[${contract.address}] ABI Not Found`)
              processing()
            }
          } else {
            log('Finish')
            process.exit()
          }
        })
      }, 300)
    }

    processing()
  })
  .catch(log)
