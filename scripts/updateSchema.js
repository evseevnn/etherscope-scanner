require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    _type: string @index(hash) .
    address: string @index(hash) .
    from: uid @reverse .
    to: uid @reverse .
    transactions: uid reverse .
    topics: [string] .
    number: int @index(int) @upsert .
    sha3Uncles: string @index(hash) .
    miner: string @index(hash) .
    name: string @index(term) .
    symbol: string @index(hash) .
    owner: string @index(hash) .
    constract: uid @reverse .
    contractAddress: string @index(hash) .
    hash: string @index(hash) @count .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
