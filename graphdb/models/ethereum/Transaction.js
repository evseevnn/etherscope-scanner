const Node = require('../Node')

class Transaction extends Node {
  get _fields() {
    return [
      'hash',
      'nonce',
      'transactionIndex',
      'value',
      'gasPrice',
      'gas',
      'input',
      'status',
      'contractAddress',
      'cumulativeGasUsed',
      'gasUsed'
    ]
  }

  get _type() {
    return 'transaction'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      hash: this.hash,
      nonce: this.nonce,
      transactionIndex: this.transactionIndex,
      value: this.value,
      gasPrice: this.gasPrice,
      gas: this.gas,
      input: this.input,
      from: this.from || null,
      to: this.to || null,
      // receipt fields
      status: this.status || null,
      contractAddress: this.contractAddress || null,
      contract: this.contract || null,
      cumulativeGasUsed: this.cumulativeGasUsed,
      gasUsed: this.gasUsed,
      logs: this.logs || null
    }
  }
}

module.exports = Transaction
