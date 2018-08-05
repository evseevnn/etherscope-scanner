const Node = require('../Node')

class Block extends Node {
  get _fields() {
    return [
      'number',
      'hash',
      'parentHash',
      'nonce',
      'sha3Uncles',
      'logsBloom',
      'transactionsRoot',
      'stateRoot',
      'miner',
      'difficulty',
      'totalDifficulty',
      'size',
      'extraData',
      'gasLimit',
      'gasUsed',
      'timestamp'
    ]
  }

  get _type() {
    return 'block'
  }

  toJSON() {
    return {
      uid: this.uid,
      _type: this._type,
      number: this.number,
      hash: this.hash,
      parentHash: this.parentHash,
      nonce: this.nonce,
      sha3Uncles: this.sha3Uncles,
      logsBloom: this.logsBloom,
      transactionsRoot: this.transactionsRoot,
      stateRoot: this.stateRoot,
      miner: this.miner,
      difficulty: this.difficulty,
      totalDifficulty: this.totalDifficulty,
      size: this.size,
      extraData: this.extraData,
      gasLimit: this.gasLimit,
      gasUsed: this.gasUsed,
      timestamp: this.timestamp,
      transactions: this.transactions || []
    }
  }
}

module.exports = Block
