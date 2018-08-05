require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    uid: uid @count .
    _type: string @index(hash) .
    address: string @index(hash) .
    from: uid @reverse .
    to: uid @reverse .
    number: int @index(int) @upsert .
    sha3Uncles: string @index(hash) .
    miner: string @index(hash) .
    name: string @index(term) .
    symbol: string @index(hash) .
    owner: string @index(hash) .
    contractAddress: string @index(hash) .
    transactions: uid @reverse .
    contract: uid @reverse .
    logs: uid @reverse .
    hash: string @index(hash) .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
