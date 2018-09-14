require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('..')
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
      .connectAsReader('scanner', async ({ blockNumber }, done) => {
        log(`[#${blockNumber}] Start processing block`)

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

                await AddressesRepository.update(await Promise.all(promises), ['address'], true)
              }

              // Add timestamp from block to transactions
              block.transactions = block.transactions.map(transaction => {
                transaction.timestamp = block.timestamp
                return transaction
              })

              // Save last transactions
              TransactionsRepository.insert(block.transactions)

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
        } else {
          log(`[#${blockNumber}] Exist`)
          setImmediate(() => done())
        }
      })
  })
