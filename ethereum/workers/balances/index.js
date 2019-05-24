require('dotenv').load()
const log = require('debug')('ethereum:listners:balances')
const TasksPool = require('../../../TasksPool')
const { BALANCES_PROCESSING } = require('..')
const Ethereum = require('../..')
const ethereum = new Ethereum(process.env.ETHEREUM_NODE_HTTP)
const repositories = require('../../../db/repositories')

const balanceProcessing = require('../balances/modules/balances')

const balancesProcessingPool = new TasksPool(BALANCES_PROCESSING)

async function boot() {
  let [{
    AddressesRepository
  }] = await Promise.all([
    repositories.connect(),
    balancesProcessingPool.connect()
  ])

  const calculateBalance = await balanceProcessing({ repositories: { AddressesRepository }, ethereum })
  // Subscribe on tasks
  balancesProcessingPool.subscribe()

  setInterval(() => {
    global.gc && global.gc()
  }, 1000)

  balancesProcessingPool.on('data', async (msg) => {
    const { from, to, amount, tokenAddress } = JSON.parse(Buffer.from(msg.content).toString())
    await calculateBalance({
      from,
      to,
      amount,
      tokenAddress
    })
    log(`Transfer [${from} -> ${to}] amount ${amount} Done`)
    balancesProcessingPool.done(msg)
  })
}

boot()
