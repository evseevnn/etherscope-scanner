const { MongoClient } = require('mongodb')
const log = require('debug')

class DB {
  constructor({ address } = { address: process.env.DB_ADDRESS || 'mongodb://localhost:27017/main' }) {
    this.address = address
  }

  async connect() {
    return new Promise((resolve, reject) => {
      MongoClient.connect(this.address, (err, client) => {
        if (err) {
          reject(err)
          process.exit()
        }
        log(`Connect to database successfully`)
        this.client = client
        resolve(client.db())
      })
    })
  }
}

module.exports = DB
