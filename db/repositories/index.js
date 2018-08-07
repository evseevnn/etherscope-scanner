const DB = require('..')
const AddressesRepository = require('./AddressesRepository')
const BlocksRepository = require('./BlocksRepository')
const LogsRepository = require('./LogsRepository')
const TransactionsRepository = require('./TransactionsRepository')

module.exports = {
  connect: async () => {
    const dbClient = await new DB().connect()
    return {
      AddressesRepository: new AddressesRepository(dbClient),
      BlocksReposiroty: new BlocksRepository(dbClient),
      LogsRepository: new LogsRepository(dbClient),
      TransactionsRepository: new TransactionsRepository(dbClient)
    }
  }
}
