require('dotenv').load()
const log = require('debug')('scripts:load-abi')
const schedule = require('node-schedule')
const RateLimiter = require('limiter').RateLimiter
const limiter = new RateLimiter(5, 'second')
const etherscanAPI = require('etherscan-api').init(process.env.ETHERSCAN_API_KEY)
const repositories = require('../../../db/repositories')

repositories.connect()
  .then(({ AddressesRepository }) => {
    // periodicaly asinkg about abi and load it
    schedule.scheduleJob('* * 0 * *', async () => {
      // Get contracts addresses without abi
      const contracts = await AddressesRepository.find({ type: 'contract', abi: { $exists: false } })
      limiter.removeTokens(1, async () => {
        if (contracts.hasNext()) {
          const contract = contracts.next()
          // trying get abi
          log(`[${contract.address}] Trying get ABI`)
          const { result: abi } = await etherscanAPI.contract.getabi(contract.address)
          // save to database
          if (abi) {
            contract.abi = abi
            AddressesRepository.upsert(contract)
            log(`[${contract.address}] ABI Saved`)
          } else {
            log(`[${contract.address}] ABI Not Found`)
          }
        }
      })
    })
  })
  .catch(log)
