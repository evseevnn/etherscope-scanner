const addressDecorator = require('./addressDecorator')
const transactionInputDecorator = require('./transactionInputDecorator')
const transactionEventsDecorator = require('./transactionEventsDecorator')
const web3 = require('web3')

module.exports = async (transaction, InterfacesRepository, AddressesRepository) => {
  let decoratedTransaction = {}
  if (transaction) {
    decoratedTransaction = {
      from: await addressDecorator(transaction.from, AddressesRepository),
      to: transaction.to || (transaction.receipt && transaction.receipt.contractAddress),
      method: null,
      tokensAmount: [],
      events: []
    }

    decoratedTransaction.to = await addressDecorator(decoratedTransaction.to, AddressesRepository)
    if (transaction.receipt && transaction.receipt.gasUsed) {
      decoratedTransaction.gasUsed = web3.utils.fromWei(web3.utils.toBN(transaction.receipt.gasUsed).mul(web3.utils.toBN(transaction.gasPrice)), 'ether')
    }

    if (transaction.receipt && transaction.receipt.cumulativeGasUsed) {
      decoratedTransaction.cumulativeGasUsed = web3.utils.fromWei(web3.utils.toBN(transaction.receipt.gasUsed).mul(web3.utils.toBN(transaction.receipt.cumulativeGasUsed)), 'ether')
    }

    let eventNameForCollectAmount = 'Transfer'

    let logs = []

    // If transaction has logs that mean what reciver is unknown contract
    if (transaction.receipt && transaction.receipt.logs && transaction.receipt.logs.length) {
      logs = transaction.receipt.logs
      if (decoratedTransaction.to.type !== 'contract') {
        // We have logs, so that mean it's contract, but we dont know how to read events of him
        // So, we just stop processing (nsq will start process again later, it's can help in case what we'll get it later)
        throw new Error(`Contract ${decoratedTransaction.to.address} not found`)
      }

      // decorate all logs addresses
      for (let logIndex = 0; logIndex < logs.length; logIndex++) {
        logs[logIndex].address = await addressDecorator(logs[logIndex].address, AddressesRepository)
        if (logs[logIndex].address.type !== 'contract') {
          // We have logs, so that mean it's contract, but we dont know how to read events of him
          // So, we just stop processing (nsq will start process again later, it's can help in case what we'll get it later)
          throw new Error(`Contract ${logs[logIndex].address.address} not found`)
        }
      }
    }

    // if contract just created set method
    if (transaction.receipt.contractAddress) {
      decoratedTransaction.to.type = 'contract'
      decoratedTransaction.method = {
        name: 'constructor'
      }
    }

    // Decode method and logs
    if (decoratedTransaction.to && decoratedTransaction.to.type === 'contract' && decoratedTransaction.to.instanceOf && decoratedTransaction.to.instanceOf.length) {
      // Decorate Transfer operations
      if (decoratedTransaction.to.instanceOf.includes('DetailedERC20') && !isNaN(decoratedTransaction.to.data.decimals)) {
        decoratedTransaction.method = transactionInputDecorator(transaction, InterfacesRepository.interfaces, decoratedTransaction.to.instanceOf)

        // transfer
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'transfer' && decoratedTransaction.method.arguments[1]) {
          decoratedTransaction.method.arguments[1] = (decoratedTransaction.method.arguments[1] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }

        // approve
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'approve' && decoratedTransaction.method.arguments[1]) {
          decoratedTransaction.method.arguments[1] = (decoratedTransaction.method.arguments[1] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
          eventNameForCollectAmount = 'Approval'
        }

        // transferFrom
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'transferFrom' && decoratedTransaction.method.arguments[2]) {
          decoratedTransaction.method.arguments[2] = (decoratedTransaction.method.arguments[2] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }
      }
    }

    const tokensAmount = {}

    decoratedTransaction.events = transactionEventsDecorator(logs, InterfacesRepository.interfaces)

    if (decoratedTransaction.events && decoratedTransaction.events.length) {
      // sorting events
      decoratedTransaction.events = decoratedTransaction.events.sort((a, b) => (a.index > b.index) ? 1 : (b.index > a.index ? -1 : 0))
      for (let e = 0; e < decoratedTransaction.events.length; e++) {
        const event = decoratedTransaction.events[e]
        if (['Transfer', 'Approval'].includes(event.name) && event.data && event.data.value) {
          event.data.value = (event.data.value / (Math.pow(10, event.address.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }
        if (
          eventNameForCollectAmount &&
          eventNameForCollectAmount === event.name &&
          event.address && event.address.data && event.address.data.symbol
        ) {
          if (!tokensAmount[event.address.address]) {
            tokensAmount[event.address.address] = {address: event.address, value: +event.data.value}
          } else {
            tokensAmount[event.address.address].value += tokensAmount[event.address.address].value + +event.data.value
          }
        }
        decoratedTransaction.events[e] = event
      }
    }
    decoratedTransaction.tokensAmount = Object.values(tokensAmount)
  }

  return decoratedTransaction
}
