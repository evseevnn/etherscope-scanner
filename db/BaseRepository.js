
class BaseRepository {
  constructor(db) {
    this.db = db
    this.collection = this.db.collection(this.name)
  }

  get name() {
    throw new Error('Not Implemented')
  }

  get uniqueFields() {
    return []
  }

  async insert(documents) {
    if (!Array.isArray(documents)) {
      documents = [documents]
    }
    const result = await this.collection.insertMany(documents)
    return result
  }

  async upsert(documents) {
    if (!Array.isArray(documents)) {
      documents = [documents]
    }
    const operations = documents.map(document => {
      const filter = {}
      this.uniqueFields.forEach(field => {
        if (document[field]) {
          filter[field] = document[field]
        }
      })
      return {
        updateOne: {
          filter,
          update: { $set: document },
          upsert: true
        }
      }
    })
    const result = await this.collection.bulkWrite(operations)
    return result
  }
}

module.exports = BaseRepository
