const BaseRepository = require('../BaseRepository')

class LogsRepository extends BaseRepository {
  get name() {
    return 'logs'
  }
}

module.exports = LogsRepository
