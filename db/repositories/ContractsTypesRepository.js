const BaseRepository = require('../BaseRepository')

class ContractsTypesRepository extends BaseRepository {
  get name() {
    return 'contractsTypes'
  }

  get uniqueFields() {
    return ['name']
  }
}

module.exports = ContractsTypesRepository
