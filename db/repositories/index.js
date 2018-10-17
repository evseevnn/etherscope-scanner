const DB = require('..')
const AddressesRepository = require('./AddressesRepository')
const BlocksRepository = require('./BlocksRepository')
const TransactionsRepository = require('./TransactionsRepository')
const InterfacesRepository = require('./InterfacesRepository')
const AccountsDevicesRepository = require('./AccountsDevicesRepository')

module.exports = {
  connect: async () => {
    const dbClient = await new DB().connect()
    return {
      AddressesRepository: new AddressesRepository(dbClient),
      BlocksReposiroty: new BlocksRepository(dbClient),
      TransactionsRepository: new TransactionsRepository(dbClient),
      InterfacesRepository: new InterfacesRepository(dbClient),
      AccountsDevicesRepository: new AccountsDevicesRepository(dbClient)
    }
  }
}
