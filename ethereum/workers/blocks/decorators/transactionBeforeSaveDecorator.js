const addressDecorator = require('./addressDecorator')
const web3 = require('web3')

module.exports = async (transaction, AddressesRepository) => {
  let decoratedTransaction = {}
  if (transaction) {
    decoratedTransaction = {
      hash: transaction.hash,
      blockNumber: transaction.blockNumber,
      transactionIndex: transaction.transactionIndex,
      status: transaction.receipt && transaction.receipt.status,
      from: await addressDecorator(transaction.from, AddressesRepository),
      to: transaction.to || (transaction.receipt && transaction.receipt.contractAddress),
      gas: transaction.gas,
      value: web3.utils.fromWei(transaction.value, 'ether'),
      method: null,
      events: []
    }
    // Status before Byzantium parity return always false, so need use rules for solve trouble
    if (transaction.blockNumber < 4370000 && transaction.receipt && !decoratedTransaction.status) {
      decoratedTransaction.status = ((transaction.receipt.gasUsed === 21000) || (transaction.receipt.gasUsed < transaction.gas) || (transaction.receipt.logs && transaction.receipt.logs.length))
    }

    decoratedTransaction.to = await addressDecorator(decoratedTransaction.to, AddressesRepository)
    if (transaction.receipt && transaction.receipt.gasUsed) {
      decoratedTransaction.gasUsed = transaction.receipt.gasUsed
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
