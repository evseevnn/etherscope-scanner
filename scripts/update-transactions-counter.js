require('dotenv').load()
const log = require('debug')('scripts:update-transactions-counter')
const repositories = require('../db/repositories')
const moment = require('moment')

repositories
  .connect()
  .then(async ({ AddressesRepository, TransactionsRepository }) => {
    async function updateAddressesStatisticForPeriod(period) {
      const fromTimestamp = moment().subtract(1, period).unix()

      // Getting active addresses
      const fromAddresses = await TransactionsRepository.distinct('from', { timestamp: { $gte: fromTimestamp } })
      const toAddresses = await TransactionsRepository.distinct('to', { timestamp: { $gte: fromTimestamp } })

      const addressesForUpdate = [...new Set([].concat(fromAddresses, toAddresses))]
      log(`Got ${addressesForUpdate.length} addresses for update`)

      const addresses = {}
      if (addressesForUpdate.length) {
        for (let i = 0; i < addressesForUpdate.length; i++) {
          const address = {
            address: addressesForUpdate[i],
            statistics: {}
          }
          address.statistics[`${period}TxOut`] = await TransactionsRepository.count({ from: address.address })
          address.statistics[`${period}TxIn`] = await TransactionsRepository.count({ to: address.address })
          addresses[address.address] = address
        }
      }

      return addresses
    }

    const addressesDayStats = await updateAddressesStatisticForPeriod('day')
    const addressesWeekStats = await updateAddressesStatisticForPeriod('week')
    const addressesMonthStats = await updateAddressesStatisticForPeriod('month')

    const addressesForSave = Object.values(Object.assign({}, addressesDayStats, addressesWeekStats, addressesMonthStats))

    await AddressesRepository.update(addressesForSave, ['address'])
    log(`Updated ${addressesForSave.length} addresses`)

    log(`Finish`)
    process.exit()
  })
  .catch((error) => log(error))
