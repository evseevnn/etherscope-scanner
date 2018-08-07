const { MongoClient } = require('mongodb')
const log = require('debug')

class DB {
  constructor({ address, database } = { address: process.env.DB_ADDRESS || 'mongodb://localhost:27017', database: process.env.DB_NAME || 'main' }) {
    this.address = address
    this.database = database
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
        resolve(client.db(this.database))
      })
    })
  }
}

module.exports = DB
