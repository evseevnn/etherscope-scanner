require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    _type: string @index(hash) .
    address: string @index(hash) .
    from.uid: uid @reverse .
    from.address: string @index(hash) .
    to.uid: uid @reverse .
    to.address: string @index(hash) .
    transactions: uid reverse .
    topics: [string] .
    number: int @index(int) @upsert .
    sha3Uncles: string @index(hash) .
    miner: string @index(hash) .
    name: string @index(term) .
    symbol: string @index(hash) .
    owner: string @index(hash) .
    contractAddress: string @index(hash) .
    hash: string @index(hash) @count .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
