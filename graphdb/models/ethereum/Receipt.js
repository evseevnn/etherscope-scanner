const Node = require('../Node')

class Receipt extends Node {
  get _fields() {
    return [
      'status',
      'contractAddress',
      'cumulativeGasUsed',
      'gasUsed',
      'logs'
    ]
  }

  get _type() {
    return 'receipt'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      status: this.status,
      contractAddress: this.contractAddress,
      contract: this.contract || null,
      cumulativeGasUsed: this.cumulativeGasUsed,
      gasUsed: this.gasUsed,
      logs: this.logs || null
    }
  }
}

module.exports = Receipt
