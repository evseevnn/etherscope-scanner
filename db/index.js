const { MongoClient } = require('mongodb')
const log = require('debug')('scanner:db')

class DB {
  constructor({ address } = { address: process.env.DB_ADDRESS || 'mongodb://localhost:27017/main' }) {
    this.address = address
  }

  async connect() {
    this.client = await MongoClient.connect(this.address, { useNewUrlParser: true })
    log(`Connect to database successfully`)
    return this.client.db()
  }
}

module.exports = DB
