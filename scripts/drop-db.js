require('dotenv').load()
const log = require('debug')('scripts:updateSchema')
const Graph = require('../graphdb')
const graph = new Graph();

(async () => {
  await graph.setDropAll()

  log(`Graph is dropped`)
  process.exit()
})()
