const BaseRepository = require('../BaseRepository')

class TransactionsRepository extends BaseRepository {
  get name() {
    return 'transactions'
  }
}

module.exports = TransactionsRepository
