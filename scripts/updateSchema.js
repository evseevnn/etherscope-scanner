require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    _type: string @index(hash) .
    address: string @index(hash) .
    from.uid: uid @reverse .
    to.uid: uid @reverse .
    from.address: string @index(hash) @count .
    to.address: string @index(hash) @count .
    number: int @index(int) @upsert @count .
    sha3Uncles: string @index(hash) .
    miner: string @index(hash) .
    name: string @index(term) .
    symbol: string @index(hash) .
    owner: string @index(hash) .
    contractAddress: string @index(hash) .
    contract.address: string @index(hash) @count .
    transactions.hash: string @index(hash) @count .
    hash: string @index(hash) @count .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
