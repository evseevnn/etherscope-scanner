require('dotenv').load()
const log = require('debug')('ethereum:listners:cache-management')
const TasksPool = require('../../../TasksPool')
const { EVENTS_PROCESSING } = require('..')

if (global.gc) {
  setInterval(() => global.gc(), 5000)
}

// Cache
const cacheManager = require('cache-manager')
const redisStore = require('cache-manager-redis-store')
const Cache = cacheManager.caching({
  store: redisStore,
  host: process.env.REDIS_HOST || 'localhost', // default value
  port: process.env.REDIS_PORT || 6379
})
// listen for redis connection error event
Cache.store.getClient().on('error', log)

new TasksPool(EVENTS_PROCESSING)
  .connectAsReader('cache-management', async ({ addresses = [] }, done) => {
    const addressesForClean = Array.from(new Set(addresses)).map(address => `address-${address}`)
    Cache.del(addressesForClean, done)
  })
