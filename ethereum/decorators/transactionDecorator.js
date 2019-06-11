const addressDecorator = require('./addressDecorator')
const transactionInputDecorator = require('./transactionInputDecorator')
const transactionEventsDecorator = require('./transactionEventsDecorator')
const log = require('debug')('decorators:transaction-decorator')
const utils = require('web3-utils')

module.exports = async (transaction, AddressesRepository, calculateBalance) => {
  let decoratedTransaction = {}
  if (transaction) {
    const from = await addressDecorator(transaction.from, AddressesRepository)
    const to = await addressDecorator(transaction.to || (transaction.receipt && transaction.receipt.contractAddress), AddressesRepository)
    decoratedTransaction = {
      hash: transaction.hash,
      blockNumber: utils.toBN(transaction.blockNumber).toString(10),
      transactionIndex: utils.toBN(transaction.transactionIndex).toString(10),
      status: transaction.receipt && transaction.receipt.status && utils.toBN(transaction.receipt.status).toString(10),
      from,
      to,
      gas: utils.toBN(transaction.gas).toString(10),
      gasPrice: utils.toBN(transaction.gasPrice).toString(10),
      value: utils.toBN(transaction.value).toString(10),
      method: null,
      events: [],
      receipt: transaction.receipt
    }

    if (transaction.receipt) {
      // Status before Byzantium parity return always false, so need use rules for solve trouble
      if (+decoratedTransaction.blockNumber < 4370000 && !decoratedTransaction.status) {
        decoratedTransaction.status = ((+transaction.receipt.gasUsed === 21000) || (+transaction.receipt.gasUsed < +decoratedTransaction.gas) || (transaction.receipt.logs && transaction.receipt.logs.length))
      }

      // if status is true send to balance calculation
      if (+decoratedTransaction.status) {
        calculateBalance && await calculateBalance({
          from: decoratedTransaction.from.address,
          to: decoratedTransaction.to.address,
          amount: decoratedTransaction.value
        })
      }

      if (transaction.receipt.gasUsed) {
        decoratedTransaction.fee = utils.toBN(transaction.receipt.gasUsed).mul(utils.toBN(decoratedTransaction.gasPrice)).toString(10)
      }

      if (transaction.receipt.cumulativeGasUsed) {
        decoratedTransaction.cumulativeGasUsed = utils.toBN(transaction.receipt.gasUsed).mul(utils.toBN(transaction.receipt.cumulativeGasUsed)).toString(10)
      }

      // If transaction has logs that mean what reciver is unknown contract
      if (transaction.receipt.logs && transaction.receipt.logs.length) {
        decoratedTransaction.to.type = 'contract'
      }

      // if contract just created set method
      if (transaction.receipt.contractAddress) {
        decoratedTransaction.to.type = 'contract'
        decoratedTransaction.method = {
          name: 'constructor'
        }
      }

      let logs = []

      // Decorate events
      decoratedTransaction.events = await transactionEventsDecorator(logs, AddressesRepository)

      // Decode method
      if (decoratedTransaction.to && decoratedTransaction.to.type === 'contract' && decoratedTransaction.to.data) {
        // Decorate Transfer operations
        try {
          const decimals = !isNaN(decoratedTransaction.to.data.decimals) ? decoratedTransaction.to.data.decimals : 1
          decoratedTransaction.method = transactionInputDecorator(transaction, decoratedTransaction.to.abi)

          if (decoratedTransaction.method) {
            if (['transfer', 'approve'].includes(decoratedTransaction.method.name)) {
              decoratedTransaction.method.arguments[0] = await addressDecorator(decoratedTransaction.method.arguments[0], AddressesRepository)
              decoratedTransaction.method.arguments[1] = (decoratedTransaction.method.arguments[1] / (Math.pow(10, decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
              // if transaction is success
              if (decoratedTransaction.method.name === 'transfer' && decoratedTransaction.status) {
                calculateBalance && await calculateBalance({
                  from: decoratedTransaction.from.address,
                  to: decoratedTransaction.method.arguments[0].address,
                  amount: decoratedTransaction.method.arguments[1],
                  tokenAddress: decoratedTransaction.to.address
                })
              }
            } else if (decoratedTransaction.method.name === 'transferFrom') {
              decoratedTransaction.method.arguments[0] = await addressDecorator(decoratedTransaction.method.arguments[0], AddressesRepository)
              decoratedTransaction.method.arguments[1] = await addressDecorator(decoratedTransaction.method.arguments[1], AddressesRepository)
              decoratedTransaction.method.arguments[2] = (decoratedTransaction.method.arguments[2] / (Math.pow(10, decoratedTransaction.to.data.decimals) || 1)).toFixed(8).replace(/\.?0+$/, '')
              // if transaction is success
              if (transaction.status) {
                calculateBalance && await calculateBalance({
                  from: decoratedTransaction.method.arguments[0],
                  to: decoratedTransaction.method.arguments[1],
                  amount: decoratedTransaction.method.arguments[2],
                  tokenAddress: decoratedTransaction.to.address
                })
              }
            }
          }
        } catch (error) {
          log('Error: ', error)
        }
      }
    }
  }

  return decoratedTransaction
}
