const Node = require('../Node')

class Contract extends Node {
  get _fields() {
    return [ 'address' ]
  }

  get _type() {
    return 'contract'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      address: this.address,
      transaction: this.transaction || null
    }
  }
}

module.exports = Contract
