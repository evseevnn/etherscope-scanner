const BaseRepository = require('../BaseRepository')

class InterfacesRepository extends BaseRepository {
  get name() {
    return 'interfaces'
  }
}

module.exports = InterfacesRepository
