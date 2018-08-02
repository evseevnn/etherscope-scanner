require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setSchema(`
    _type: string @index(hash) .
    address: string @index(hash) .
    number: string @index(hash) .
    sha3Uncles: string @index(hash) .
    miner: string @index(hash) .
    name: string @index(term) .
    symbol: string @index(hash) .
    owner: string @index(hash) .
    contractAddress: string @index(hash) .
    hash: string @index(hash) .
  `)

  log(`Schema succeful apply`)
  process.exit()
})()
