const addressDecorator = require('./addressDecorator')
const transactionInputDecorator = require('./transactionInputDecorator')
const transactionEventsDecorator = require('./transactionEventsDecorator')

module.exports = async (transaction, InterfacesRepository, AddressesRepository, forceContractExist = false) => {
  let decoratedTransaction = {}
  if (transaction) {
    decoratedTransaction = {
      from: await addressDecorator(transaction.from, AddressesRepository),
      to: transaction.to || (transaction.receipt && transaction.receipt.contractAddress),
      method: null,
      events: []
    }

    decoratedTransaction.to = await addressDecorator(decoratedTransaction.to, AddressesRepository)

    let logs = []

    if (transaction.receipt) {
      // If transaction has logs that mean what reciver is unknown contract
      if (transaction.receipt.logs && transaction.receipt.logs.length) {
        logs = transaction.receipt.logs
        if (decoratedTransaction.to.type !== 'contract') {
          if (forceContractExist) {
            decoratedTransaction.to.type = 'contract'
          } else {
            // We have logs, so that mean it's contract, but we dont know how to read events of him
            // So, we just stop processing (nsq will start process again later, it's can help in case what we'll get it later)
            throw new Error(`Contract ${decoratedTransaction.to.address} not found`)
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
    }

    // Decorate events
    decoratedTransaction.events = await transactionEventsDecorator(logs, InterfacesRepository.interfaces, AddressesRepository)

    // Decode method
    if (decoratedTransaction.to && decoratedTransaction.to.type === 'contract' && decoratedTransaction.to.instanceOf && decoratedTransaction.to.instanceOf.length) {
      // Decorate Transfer operations
      if (decoratedTransaction.to.instanceOf.includes('DetailedERC20') && !isNaN(decoratedTransaction.to.data.decimals)) {
        decoratedTransaction.method = transactionInputDecorator(transaction, InterfacesRepository.interfaces, decoratedTransaction.to.instanceOf)

        // transfer
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'transfer' && decoratedTransaction.method.arguments[1]) {
          decoratedTransaction.method.arguments[0] = await addressDecorator(decoratedTransaction.method.arguments[0], AddressesRepository)
          decoratedTransaction.method.arguments[1] = (decoratedTransaction.method.arguments[1] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }

        // approve
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'approve' && decoratedTransaction.method.arguments[1]) {
          decoratedTransaction.method.arguments[0] = await addressDecorator(decoratedTransaction.method.arguments[0], AddressesRepository)
          decoratedTransaction.method.arguments[1] = (decoratedTransaction.method.arguments[1] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }

        // transferFrom
        if (decoratedTransaction.method && decoratedTransaction.method.name === 'transferFrom' && decoratedTransaction.method.arguments[2]) {
          decoratedTransaction.method.arguments[0] = await addressDecorator(decoratedTransaction.method.arguments[0], AddressesRepository)
          decoratedTransaction.method.arguments[1] = await addressDecorator(decoratedTransaction.method.arguments[1], AddressesRepository)
          decoratedTransaction.method.arguments[2] = (decoratedTransaction.method.arguments[2] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
        }
      }
    }
  }

  return decoratedTransaction
}
