const dgraph = require('dgraph-js')

const dgraphClient = new dgraph.DgraphClient(
  new dgraph.DgraphClientStub()
)
const txn = dgraphClient.newTxn();

(async () => {
  // Set schema
  const schema = 'name: string @index(exact) .'
  const op = new dgraph.Operation()
  op.setSchema(schema)
  await dgraphClient.alter(op)

  // Create data.
  const p = {
    name: 'Alice'
  }

  // Run mutation.
  const mu = new dgraph.Mutation()
  mu.setSetJson(p)
  const result = await txn.mutate(mu)
  console.log(result)
})()
