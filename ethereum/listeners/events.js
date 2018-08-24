require('dotenv').load()
const log = require('debug')('ethereum:listners:events')
const TasksPool = require('../../TasksPool')
const topicsEnum = require('./ethereum/topics')
const { EVENTS_LISTNER } = require('.')
// const Ethereum = require('../')
// const ethereum = new Ethereum()

new TasksPool(EVENTS_LISTNER)
  .connectAsReader(async (data, done) => {
    // When event with changing balance, need load new balance of address
    let [action, from = null, to = null] = data.topics

    switch (true) {
      case action.startsWith(topicsEnum.TRANSFER):
        log('Transfer')
        break
      case action.startsWith(topicsEnum.ISSUANCE):
        log('Insuance')
        break
      case action.startsWith(topicsEnum.BURN):
        log('Burn')
        break
    }

    log(data)
    done()
  })
