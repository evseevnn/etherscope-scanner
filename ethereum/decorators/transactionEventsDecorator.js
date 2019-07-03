const { cleanWeb4DecodedFields } = require('../helpers')
const { AbiCoder } = require('web3-eth-abi')
const logger = require('debug')('decorators:transaction-events-decorator')
const addressDecorator = require('./addressDecorator')
const isAddress = new RegExp('^0x[a-f0-9]{40}$', 'i')

const { events } = require('../interfaces')

module.exports = async (logs, AddressesRepository) => {
  const decoratedEvents = []
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // decorate log addresses
    const address = await addressDecorator(log.address, AddressesRepository)
    if (address.type === 'contract') {
      const eventHash = log.topics && log.topics[0] // Take event hash
      if (eventHash) {
        const event = events[eventHash.substring(2)]
        if (event && log.data !== '0x') {
          try {
            // Checking abi input
            let eventsInputs = event.inputs
            const indexedInput = eventsInputs.filter(input => input.indexed)
            const topicsData = log.topics.slice(1)
            if (indexedInput.length > topicsData.length) {
              eventsInputs = eventsInputs.map(input => {
                input.indexed = false
                return input
              })
            }
            const data = Object.assign({}, AbiCoder().decodeLog(eventsInputs, log.data, topicsData))
            const clearEventData = cleanWeb4DecodedFields(data, true)
            if (['Transfer', 'Approval'].includes(event.name) && clearEventData && clearEventData.value) {
              clearEventData.value = (clearEventData.value / (Math.pow(10, address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
            }
  
            const fields = Object.keys(clearEventData)
            for (let i = 0; i < fields.length; i++) {
              if (isAddress.test(clearEventData[fields[i]])) {
                clearEventData[fields[i]] = await addressDecorator(clearEventData[fields[i]], AddressesRepository, true)
              }
            }
  
            decoratedEvents.push({
              index: log.logIndex,
              address: (({ address, type, data, instanceOf }) => ({ address, type, data, instanceOf }))(address),
              name: event.name,
              code: event._signature,
              data: clearEventData
            })
            // logger(`Event ${events[eventHash].name}`)
          } catch (error) {
            logger('Cannot decode events', error, {inputs: event.inputs, data: log.data, topics: log.topics})
          }
        }
      }
    }
  }

  return decoratedEvents
}
