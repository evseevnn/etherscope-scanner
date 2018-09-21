const BaseRepository = require('../BaseRepository')

class AddressesRepository extends BaseRepository {
  get name() {
    return 'contracts'
  }
}

module.exports = AddressesRepository
