require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_URL })

const repositories = require('../../db/repositories')

repositories
  .connect()
  .then(({
    BlocksReposiroty,
    AddressesRepository
  }) => {
    new TasksPool(NEW_BLOCKS_LISTNER)
      .connectAsReader(async ({ blockNumber }, done) => {
        log(`[#${blockNumber}] Start processing block`)

        try {
          // Make block from block data
          const { block, transactions } = await ethereum.getBlockData(blockNumber)

          if (transactions.length) {
            const transactionsWithContracts = transactions.filter(transaction => transaction.receipt && transaction.receipt.contractAddress)
            if (transactionsWithContracts.length) {
              // Save contracts
              const promises = []
              transactionsWithContracts.forEach(transaction => {
                const interfaces = ethereum.getContractInterfaces(transaction.receipt.contractAddress)
                promises.push(ethereum.getContractDataByInterfaces(transaction.receipt.contractAddress, interfaces).then(data => {
                  return {
                    instanceOf: interfaces,
                    data,
                    address: transaction.receipt.contractAddress,
                    type: AddressesRepository.ADDRESS_TYPE_CONTRACT,
                    createdAt: new Date(block.timestamp * 1000)
                  }
                }))
              })

              // Save transactions
              await AddressesRepository.insert(await Promise.all(promises))
            }
            // Replace transaction object on trnsaction hash in block
            block.transactions = block.transactions.map(transaction => transaction.hash)
          }

          // Save block at last
          await BlocksReposiroty.insert(block)

          log(`[#${blockNumber}] Done (tx=${transactions.length})`)
          setImmediate(() => done())
        } catch (error) {
          log(`[#${blockNumber}] processing error`, error)
          process.exit()
        }
      })
  })
