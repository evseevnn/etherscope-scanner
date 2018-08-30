require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks:contracts')
const logBlockProcessing = require('debug')('ethereum:listners:blocks:processing')
const TasksPool = require('../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('../')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

const repositories = require('../../db/repositories')

// Exit after 3 hours of work.
// Need for temporary fix problem with memory overflow
// PM2 will start process again
setTimeout(() => {
  process.exit(0)
}, 3 * 60 * 60 * 1000)

repositories
  .connect()
  .then(({
    BlocksReposiroty,
    AddressesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(NEW_BLOCKS_LISTNER)
      .connectAsReader(async ({ blockNumber }, done) => {
        logBlockProcessing(`[#${blockNumber}] Start processing block`)

        const [ isBlockExist ] = await BlocksReposiroty.find({ number: blockNumber }).limit(1).toArray()

        if (!isBlockExist) {
          try {
            // Make block from block data
            const { block, transactions } = await ethereum.getBlockData(blockNumber)

            if (transactions.length) {
              const transactionsWithContracts = transactions.filter(transaction => transaction.receipt && transaction.receipt.contractAddress)
              if (transactionsWithContracts.length) {
                // Save contracts
                const promises = []
                transactionsWithContracts.forEach(transaction => {
                  const opcode = ethereum.getContractOpcode(transaction.receipt.contractAddress)
                  const interfaces = ethereum.getContractInterfaces(transaction.receipt.contractAddress, opcode)
                  promises.push(ethereum.getContractDataByInterfaces(transaction.receipt.contractAddress, interfaces).then(data => {
                    log(`[#${blockNumber}][${transaction.receipt.contractAddress}] interfaces ${interfaces.join(', ')}`)
                    return {
                      instanceOf: interfaces,
                      data,
                      opcode,
                      address: transaction.receipt.contractAddress,
                      type: AddressesRepository.ADDRESS_TYPE_CONTRACT,
                      createdAt: new Date(block.timestamp * 1000)
                    }
                  }))
                })

                await AddressesRepository.upsert(await Promise.all(promises))
              }

              // Save last transactions
              TransactionsRepository.insert(block.transactions)

              // Replace transaction object on trnsaction hash in block
              block.transactions = block.transactions.map(transaction => transaction.hash)
            }

            // Save block at last
            await BlocksReposiroty.insert(block)

            logBlockProcessing(`[#${blockNumber}] Done (tx=${transactions.length})`)
            setImmediate(() => done())
          } catch (error) {
            logBlockProcessing(`[#${blockNumber}] processing error`, error)
            process.exit()
          }
        } else {
          logBlockProcessing(`[#${blockNumber}] Exist`)
          setImmediate(() => done())
        }
      })
  })
