const Node = require('../Node')

class ContractERC20 extends Node {
  get _fields() {
    return [
      'address',
      'name',
      'decimals',
      'symbol',
      'totalSupply',
      'owner'
    ]
  }

  get _type() {
    return 'contract'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      address: this.address,
      transaction: this.transaction || null,
      name: this.name || null,
      decimals: this.decimals || null,
      symbol: this.symbol || null,
      totalSupply: this.totalSupply || null,
      owner: this.owner || null
    }
  }
}

module.exports = ContractERC20
