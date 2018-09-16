require('dotenv').load()
const log = require('debug')('scripts:update-transactions-counter')
const repositories = require('../db/repositories')
const moment = require('moment')

repositories
  .connect()
  .then(async ({ AddressesRepository, TransactionsRepository }) => {
    const addresses = {}
    async function updateAddressesStatisticForPeriod(period) {
      const fromTimestamp = moment().subtract(1, period).unix()

      // Getting active addresses
      const fromAddresses = await TransactionsRepository.distinct('from', { timestamp: { $gte: fromTimestamp } })
      const toAddresses = await TransactionsRepository.distinct('to', { timestamp: { $gte: fromTimestamp } })

      const addressesForUpdate = [...new Set([].concat(fromAddresses, toAddresses))]
      log(`Got ${addressesForUpdate.length} addresses for update on period '${period}'`)

      if (addressesForUpdate.length) {
        for (let i = 0; i < addressesForUpdate.length; i++) {
          if (!addresses[addressesForUpdate[i]]) {
            addresses[addressesForUpdate[i]] = {
              address: addressesForUpdate[i],
              statistics: {}
            }
          }

          addresses[addressesForUpdate[i]].statistics[`${period}TxOut`] = await TransactionsRepository.count({ from: addresses[addressesForUpdate[i]].address })
          addresses[addressesForUpdate[i]].statistics[`${period}TxIn`] = await TransactionsRepository.count({ to: addresses[addressesForUpdate[i]].address })
        }
      }
    }

    await updateAddressesStatisticForPeriod('day')
    await updateAddressesStatisticForPeriod('week')
    await updateAddressesStatisticForPeriod('month')

    const forSave = Object.values(addresses)
    await AddressesRepository.update(forSave, ['address'])
    log(`Updated ${forSave.length} addresses`)

    log(`Finish`)
    process.exit()
  })
  .catch((error) => log(error))
