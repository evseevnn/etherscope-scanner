const BaseRepository = require('../BaseRepository')

class AddressesRepository extends BaseRepository {
  get name() {
    return 'addresses'
  }

  get uniqueFields() {
    return ['address']
  }
}

module.exports = AddressesRepository
