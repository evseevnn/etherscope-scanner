const Node = require('../Node')

class Log extends Node {
  get _fields() {
    return [
      'data',
      'topics',
      'logIndex',
      'address'
    ]
  }

  get _type() {
    return 'log'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      data: this.data,
      topics: this.topics,
      logIndex: this.logIndex,
      address: this.address,
      block: this.block || null,
      transaction: this.transaction || null
    }
  }
}

module.exports = Log
