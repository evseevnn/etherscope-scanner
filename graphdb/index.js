const dgraph = require('dgraph-js')
const grpc = require('grpc')
const Node = require('./models/Node')

class Graph {
  constructor({ address } = { address: process.env.GRAPHDB_ADDRESS || 'localhost:9080' }) {
    this.client = new dgraph.DgraphClient(
      new dgraph.DgraphClientStub(
        address,
        grpc.credentials.createInsecure()
      )
    )
  }

  async setDropAll() {
    const op = new dgraph.Operation()
    op.setDropAll(true)
    await this.client.alter(op)
  }

  async setSchema(schema) {
    const op = new dgraph.Operation()
    op.setSchema(schema)
    await this.client.alter(op)
  }

  /**
   * Insert node to graph
   * @param {Node} node
   */
  async insert(node) {
    if (node instanceof Node === false) {
      throw new Error('Make link possible only between two Node objects')
    }
    const txn = this.client.newTxn()
    const mu = new dgraph.Mutation()
    mu.setSetJson(node.toJSON())
    await txn.mutate(mu)
    const commitResult = await txn.commit()
    return commitResult
  }

  async find(query, vars = {}) {
    const res = await this.client.newTxn().queryWithVars(query, vars)
    return res.getJson()
  }
}

module.exports = Graph
