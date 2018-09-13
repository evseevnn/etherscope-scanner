const BaseRepository = require('../BaseRepository')

class AddressesRepository extends BaseRepository {
  get ADDRESS_TYPE_CONTRACT() {
    return 'contract'
  }

  get ADDRESS_TYPE_ACCOUNT() {
    return 'address'
  }

  get name() {
    return 'addresses'
  }
}

module.exports = AddressesRepository
