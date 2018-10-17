const BaseRepository = require('../BaseRepository')

class AccountsDevicesRepository extends BaseRepository {
  get name() {
    return 'accountsDevices'
  }
}

module.exports = AccountsDevicesRepository
