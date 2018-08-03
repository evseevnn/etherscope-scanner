require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    _type: string @index(string) .
    address: string @index(string) .
    from.uid: uid @reverse .
    from.address: string @index(string) .
    to.uid: uid @reverse .
    to.address: string @index(string) .
    transactions: uid reverse .
    topics: [string] .
    number: int @index(int) @upsert .
    sha3Uncles: string @index(string) .
    miner: string @index(string) .
    name: string @index(term) .
    symbol: string @index(string) .
    owner: string @index(string) .
    contractAddress: string @index(string) .
    hash: string @index(string) @count .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
