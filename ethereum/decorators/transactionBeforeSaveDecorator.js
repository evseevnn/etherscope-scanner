const addressDecorator = require('./addressDecorator')
const utils = require('web3-utils')

module.exports = async (transaction, AddressesRepository) => {
  let decoratedTransaction = {}
  if (transaction) {
    decoratedTransaction = {
      hash: transaction.hash,
      blockNumber: utils.toBN(transaction.blockNumber).toString(10),
      transactionIndex: utils.toBN(transaction.transactionIndex).toString(10),
      status: transaction.receipt && transaction.receipt.status && utils.toBN(transaction.receipt.status).toString(10),
      from: await addressDecorator(transaction.from, AddressesRepository),
      to: transaction.to || (transaction.receipt && transaction.receipt.contractAddress),
      gas: utils.toBN(transaction.gas).toString(10),
      gasPrice: utils.toBN(transaction.gasPrice).toString(10),
      value: utils.toBN(transaction.value).toString(10),
      method: null,
      events: []
    }
    decoratedTransaction.to = await addressDecorator(decoratedTransaction.to, AddressesRepository)

    if (transaction.receipt) {
      // Status before Byzantium parity return always false, so need use rules for solve trouble
      if (+decoratedTransaction.blockNumber < 4370000 && !decoratedTransaction.status) {
        decoratedTransaction.status = ((transaction.receipt.gasUsed === 21000) || (transaction.receipt.gasUsed < transaction.gas) || (transaction.receipt.logs && transaction.receipt.logs.length))
      }

      if (transaction.receipt.gasUsed) {
        decoratedTransaction.fee = utils.toBN(transaction.receipt.gasUsed).mul(utils.toBN(transaction.gasPrice)).toString(10)
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
    }
  }

  return decoratedTransaction
}
