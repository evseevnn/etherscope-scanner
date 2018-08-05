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
    return 'erc20'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      address: this.address,
      transaction: this.transaction || null,
      name: this.name,
      decimals: this.decimals,
      symbol: this.symbol,
      totalSupply: this.totalSupply,
      owner: this.owner
    }
  }
}

module.exports = ContractERC20
