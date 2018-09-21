const { cleanWeb4DecodedFields } = require('../../../helpers')
const ABICoder = require('web3-eth-abi')
const logger = require('debug')('decorators:transaction-events-decorator')

module.exports = (logs, interfaces) => {
  const decoratedEvents = []
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // Prepare contracts data
    const instanceOf = log.address && log.address.instanceOf
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
      if (event) {
        const data = Object.assign({}, ABICoder.decodeLog(event.inputs, log.data, log.topics))
        decoratedEvents.push({
          index: log.logIndex,
          address: log.address,
          name: events[eventHash].name,
          code: events[eventHash]._signature,
          data: cleanWeb4DecodedFields(data, true)
        })
        logger(`Event ${events[eventHash].name}`)
      } else {
        logger(`Unknown event ${eventHash}`)
      }
    } else {
      logger(`Unknown event on contract without instanceOf`, log.address)
    }
  }

  return decoratedEvents
}
