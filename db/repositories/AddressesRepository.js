const BaseRepository = require('../BaseRepository')

class AddressesRepository extends BaseRepository {
  get ADDRESS_TYPE_CONTRACT() {
    return 'contract'
  }

  get ADDRESS_TYPE_ACCOUNT() {
    return 'account'
  }

  get name() {
    return 'addresses'
  }

  get uniqueFields() {
    return ['address']
  }
}

module.exports = AddressesRepository
