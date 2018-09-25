const addressDecorator = require('./addressDecorator')
const web3 = require('web3')

module.exports = async (transaction, AddressesRepository) => {
  let decoratedTransaction = {}
  if (transaction) {
    decoratedTransaction = {
      hash: transaction.hash,
      blockNumber: transaction.blockNumber,
      status: transaction.receipt && transaction.receipt.status,
      from: await addressDecorator(transaction.from, AddressesRepository, true),
      to: transaction.to || (transaction.receipt && transaction.receipt.contractAddress),
      gas: transaction.gas,
      value: web3.utils.fromWei(transaction.value, 'ether'),
      method: null,
      tokensAmount: [],
      events: []
    }

    decoratedTransaction.to = await addressDecorator(decoratedTransaction.to, AddressesRepository, true)
    if (transaction.receipt && transaction.receipt.gasUsed) {
      decoratedTransaction.fee = web3.utils.fromWei(web3.utils.toBN(transaction.receipt.gasUsed).mul(web3.utils.toBN(transaction.gasPrice)), 'ether')
    }

    if (transaction.receipt && transaction.receipt.cumulativeGasUsed) {
      decoratedTransaction.cumulativeGasUsed = web3.utils.fromWei(web3.utils.toBN(transaction.receipt.gasUsed).mul(web3.utils.toBN(transaction.receipt.cumulativeGasUsed)), 'ether')
    }

    decoratedTransaction.gasPrice = web3.utils.fromWei(transaction.gasPrice, 'ether')

    // If transaction has logs that mean what reciver is unknown contract
    if (transaction.receipt && transaction.receipt.logs && transaction.receipt.logs.length) {
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

  return decoratedTransaction
}
