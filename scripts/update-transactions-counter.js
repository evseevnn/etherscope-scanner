require('dotenv').load()
const log = require('debug')('scripts:update-transactions-counter')
const repositories = require('../db/repositories')
const moment = require('moment')

repositories
  .connect()
  .then(async ({ AddressesRepository, TransactionsRepository }) => {
    const addresses = {}
    async function updateAddressesStatisticForPeriod(period) {
      return new Promise(async (resolve) => {
        const fromDate = moment().subtract(1, period).toDate()

        // Getting active addresses
        const addressesSet = new Set()
        const transactionsCursor = await TransactionsRepository.find({ createdAt: { $gte: fromDate } })

        transactionsCursor.forEach(transaction => {
          if (transaction.from.type === 'contract') {
            addressesSet.add(transaction.from.address)
          }
          if (transaction.to.type === 'contract') {
            addressesSet.add(transaction.to.address)
          }
        }, async () => {
          const addressesForUpdate = Array.from(addressesSet)
          log(`Got ${addressesForUpdate.length} addresses for update on period '${period}'`)

          if (addressesForUpdate.length) {
            for (let i = 0; i < addressesForUpdate.length; i++) {
              if (!addresses[addressesForUpdate[i]]) {
                addresses[addressesForUpdate[i]] = {
                  address: addressesForUpdate[i],
                  statistics: {}
                }
              }

              addresses[addressesForUpdate[i]].statistics[`${period}TxOut`] = await TransactionsRepository.count({ 'from.address': addresses[addressesForUpdate[i]].address })
              addresses[addressesForUpdate[i]].statistics[`${period}TxIn`] = await TransactionsRepository.count({ 'to.address': addresses[addressesForUpdate[i]].address })
            }
          }

          resolve()
        })
      })
    }
    log('Start calculate statistic for day period')
    await updateAddressesStatisticForPeriod('day')
    log('Start calculate statistic for week period')
    await updateAddressesStatisticForPeriod('week')
    log('Start calculate statistic for month period')
    await updateAddressesStatisticForPeriod('month')

    log('Saving statistics')
    const forSave = Object.values(addresses)
    await AddressesRepository.update(forSave, ['address'])
    log(`Updated ${forSave.length} addresses`)

    log(`Finish`)
    process.exit()
  })
  .catch((error) => log(error))
