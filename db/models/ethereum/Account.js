const Node = require('../Node')

class Account extends Node {
  get _fields() {
    return [ 'address', 'balance' ]
  }

  get _type() {
    return 'account'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      address: this.address,
      balance: this.balance
    }
  }
}

module.exports = Account
