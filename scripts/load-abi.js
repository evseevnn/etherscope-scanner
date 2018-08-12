require('dotenv').load()
const log = require('debug')('scripts:load-abi')
const schedule = require('node-schedule')
const RateLimiter = require('limiter').RateLimiter
const limiter = new RateLimiter(5, 'second')
const etherscanAPI = require('etherscan-api').init(process.env.ETHERSCAN_API_KEY)
const repositories = require('../db/repositories')
const web3 = require('web3')

async function getABIData(address, abi) {
  if (!Array.isArray(abi)) {
    throw new Error(`Cannot read abi data`)
  }
  const contract = new web3.eth.contract(address, abi)
  const abiData = { constants: {}, methods: {}, payableMethods: [] }
  const promises = []
  abi.forEach(abiMethod => {
    if (abiMethod.name) {
      promises.push(new Promise((resolve, reject) => {
        if (abiMethod.constant) {
          contract.methods[abiMethod.name]().call()
          .then(value => (abiData.constants[abiMethod.name] = value))
          .then(resolve)
          .catch(error => log(error))
        } else {
          const method = `${abiMethod.name}(${abiMethod.inputs.map(input => input.type).join(',')})`
          const methodId = web3.utils.sha3(method).substr(0, 10)
          abiData.methods[methodId] = method
          if (abiMethod.payable) {
            abiData.payableMethods.push(methodId)
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
    // periodicaly asinkg about abi and load it
    // schedule.scheduleJob('* 41 * * * *', async () => {
      // Get contracts addresses without abi
    const contracts = await AddressesRepository.find({ type: AddressesRepository.ADDRESS_TYPE_CONTRACT, abi: { $exists: false } })
    limiter.removeTokens(1, async () => {
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
              contract.abi = abi
              try {
                const abiData = await getABIData(JSON.parse(abi))
                Object.assign(contract, abiData)
              } catch (e) {
                log(`[${contract.address}] Broken ABI`, e)
                return
              }
              await AddressesRepository.upsert(contract)
              log(`[${contract.address}] ABI Saved`)
            } else {
              log(`[${contract.address}] ABI Not Found`)
            }
          } catch (error) {
            log(`[${contract.address}] ABI Not Found`)
          }
        }
      })
    })
    // })
  })
  .catch(log)
