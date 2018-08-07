const BaseRepository = require('../BaseRepository')

class BlocksRepository extends BaseRepository {
  get name() {
    return 'blocks'
  }
}

module.exports = BlocksRepository
