const { cleanWeb4DecodedFields } = require('../../../helpers')
const ABICoder = require('web3-eth-abi')
const logger = require('debug')('decorators:transaction-events-decorator')
const addressDecorator = require('./addressDecorator')

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

        const eventHash = log.topics.shift()
        const event = events[eventHash]
        if (event && log.data !== '0x') {
          try {
            const data = Object.assign({}, ABICoder.decodeLog(event.inputs, log.data, log.topics))
            const clearEventData = cleanWeb4DecodedFields(data, true)
            if (['Transfer', 'Approval'].includes(events[eventHash].name) && clearEventData && clearEventData.value) {
              clearEventData.value = (clearEventData.value / (Math.pow(10, address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
            }
            if (clearEventData.from) {
              clearEventData.from = await addressDecorator(clearEventData.from, AddressesRepository)
            }
            if (clearEventData.to) {
              clearEventData.to = await addressDecorator(clearEventData.to, AddressesRepository)
            }
            decoratedEvents.push({
              index: log.logIndex,
              address,
              name: events[eventHash].name,
              code: events[eventHash]._signature,
              data: clearEventData
            })
            logger(`Event ${events[eventHash].name}`)
          } catch (error) {
            logger('Cannot decode events', error, {inputs: event.inputs, data: log.data, topics: log.topics})
          }
        } else {
          logger(`Unknown event ${eventHash}`)
        }
      } else {
        logger(`Unknown event on contract without instanceOf`, address)
      }
    }
  }

  return decoratedEvents
}
