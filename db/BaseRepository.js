
class BaseRepository {
  constructor(db) {
    this.db = db
    this.collection = this.db.collection(this.name)
  }

  get name() {
    throw new Error('Not Implemented')
  }

  find(filter, projection) {
    return this.collection.find(filter, { projection })
  }

  count(filter) {
    return this.collection.countDocuments(filter)
  }

  distinct(field, filter = {}) {
    return this.collection.distinct(field, filter)
  }

  async insert(documents) {
    if (!Array.isArray(documents)) {
      documents = [documents]
    }
    const result = await this.collection.insertMany(documents)
    return result
  }

  async update(documents, filterBy = [], upsert = false) {
    if (!Array.isArray(documents)) {
      documents = [documents]
    }
    if (!documents.length) {
      return []
    }
    const operations = documents.map(document => {
      const filter = {}
      filterBy.forEach(field => {
        if (document[field]) {
          filter[field] = document[field]
        }
      })
      delete document._id
      return {
        updateOne: {
          filter,
          update: { $set: document },
          upsert
        }
      }
    })
    const result = await this.collection.bulkWrite(operations)
    return result
  }
}

module.exports = BaseRepository
