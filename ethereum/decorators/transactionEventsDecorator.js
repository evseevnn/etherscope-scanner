const { cleanWeb4DecodedFields } = require('../helpers')
const ABICoder = require('web3-eth-abi')
const logger = require('debug')('decorators:transaction-events-decorator')
const addressDecorator = require('./addressDecorator')
const isAddress = new RegExp('^0x[a-f0-9]{40}$', 'i')

module.exports = async (logs, interfaces, AddressesRepository) => {
  const decoratedEvents = []
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // decorate log addresses
    const address = await addressDecorator(log.address, AddressesRepository)
    if (address.type === 'contract') {
      // Prepare contracts data
      const instanceOf = address.instanceOf
      if (instanceOf) {
        const events = {}
        interfaces.forEach(interfaceData => {
          if (instanceOf.includes(interfaceData.contractName)) {
            const eventsEntities = interfaceData.abi.filter(entity => entity.type === 'event')
            eventsEntities.forEach(event => {
              events[event._hash] = event
            })
          }
        })

        const eventHash = log.topics && log.topics[0]
        const event = events[eventHash]
        if (event && log.data !== '0x') {
          try {
            // Checking abi input
            const indexedInput = event.inputs.filter(input => input.indexed)
            const topicsData = log.topics.slice(1)
            console.log('Check it: ', indexedInput, topicsData)
            if (indexedInput.length > topicsData.length) {
              event.inputs = event.inputs.map(input => {
                input.indexed = false
                return input
              })
            }
            const data = Object.assign({}, ABICoder.decodeLog(event.inputs, log.data, topicsData))
            const clearEventData = cleanWeb4DecodedFields(data, true)
            if (['Transfer', 'Approval'].includes(events[eventHash].name) && clearEventData && clearEventData.value) {
              clearEventData.value = (clearEventData.value / (Math.pow(10, address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
            }

            const fields = Object.keys(clearEventData)
            for (let i = 0; i < fields.length; i++) {
              if (isAddress.test(clearEventData[fields[i]])) {
                clearEventData[fields[i]] = await addressDecorator(clearEventData[fields[i]], AddressesRepository)
              }
            }

            decoratedEvents.push({
              index: log.logIndex,
              address,
              name: events[eventHash].name,
              code: events[eventHash]._signature,
              data: clearEventData
            })
            // logger(`Event ${events[eventHash].name}`)
          } catch (error) {
            logger('Cannot decode events', error, {inputs: event.inputs, data: log.data, topics: log.topics})
          }
        } else {
          // logger(`Unknown event ${eventHash}`)
        }
      } else {
        logger(`Unknown event on contract without instanceOf`, address)
      }
    }
  }

  return decoratedEvents
}
