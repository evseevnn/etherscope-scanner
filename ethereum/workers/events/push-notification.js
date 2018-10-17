require('dotenv').load()
const log = require('debug')('ethereum:events:push-notifications')
const https = require('https')
const TasksPool = require('../../../TasksPool')
const { EVENTS_PROCESSING } = require('..')

const repositories = require('../../../db/repositories')

const sendNotification = (data) => {
  const options = {
    host: 'onesignal.com',
    port: 443,
    path: '/api/v1/notifications',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: 'Basic NGEwMGZmMjItY2NkNy0xMWUzLTk5ZDUtMDAwYzI5NDBlNjJj'
    }
  }

  const req = https.request(options, (res) => {
    res.on('data', (data) => {
      log(`[${data.id}] Sent ${data.recipients} notifications`)
    })
  })

  req.on('error', (e) => {
    log('ERROR:')
    log(e)
  })

  req.write(JSON.stringify(data))
  req.end()
}

repositories
  .connect()
  .then(({
    AccountsDevicesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(EVENTS_PROCESSING)
      .connectAsReader('push-notifications', async ({ hash }, done) => {
        let [ transaction ] = await TransactionsRepository.find({ hash }).toArray()

        if (transaction) {
          // Getting addresses from events
          let incomingAddresses = new Set([transaction.to.address])
          let outcomingAddresses = new Set([transaction.from.address])
          for (let i = 0; i < transaction.events.length; i++) {
            const event = transaction.events[i]
            if (
              event.name === 'Transfer' &&
              event.address.instanceOf.includes('ERC20Basic') &&
              typeof event.address.data.decimals !== 'undefined'
            ) {
              incomingAddresses.add(event.data.to.address)
              outcomingAddresses.add(event.data.from.address)
            }
          }

          incomingAddresses = Array.from(incomingAddresses)
          outcomingAddresses = Array.from(outcomingAddresses)
          const addresses = Array.from(new Set([].concat(incomingAddresses, outcomingAddresses)))

          // Get users subscriptions on this transaction
          const accountDevices = await AccountsDevicesRepository.find({ address: addresses }).toArray()

          const deviceIds = accountDevices.map(device => device.deviceId)
          if (deviceIds.length) {
            var message = {
              app_id: process.env.ONESIGNAL_APP_ID,
              headings: {en: 'Etherscope notification'},
              contents: {en: 'New transaction involving your address'},
              url: `${process.env.FRONTEND_BASE_URL}tx/${hash}`,
              include_player_ids: deviceIds,
              priority: 10
            }

            sendNotification(message)
          }
        }
        done()
      })
  })
