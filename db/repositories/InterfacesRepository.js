const BaseRepository = require('../BaseRepository')

class InterfacesRepository extends BaseRepository {
  constructor(db) {
    super(db)
    // @TODO: LRU cahce
    this.interfaces = []
    this.find().toArray()
      .then(interfaces => {
        this.interfaces = interfaces
      })
  }

  get name() {
    return 'interfaces'
  }
}

module.exports = InterfacesRepository
