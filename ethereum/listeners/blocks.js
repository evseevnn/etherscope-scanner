require('dotenv').load()
const log = require('debug')('ethereum:listners:blocks')
const TasksPool = require('../../TasksPool')
const { NEW_BLOCKS_LISTNER } = require('.')
const Ethereum = require('..')
const ethereum = new Ethereum({ url: process.env.ETHEREUM_NODE_WS })

const repositories = require('../../db/repositories')

// FIXIT: PLS
// Exit after 1 hours of work.
// Need for temporary fix problem with memory overflow
// PM2 will start process again
setTimeout(() => {
  process.exit(0)
}, 1 * 60 * 60 * 1000)

repositories
  .connect()
  .then(({
    BlocksReposiroty,
    AddressesRepository,
    TransactionsRepository
  }) => {
    new TasksPool(NEW_BLOCKS_LISTNER)
      .connectAsReader('blocks', async ({ blockNumber }, done) => {
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
                const addressesForSave = []
                for (let i = 0; i < transactionsWithContracts.length; i++) {
                  const transactionWithContract = transactionsWithContracts[i]
                  const opcode = ethereum.getContractOpcode(transactionWithContract.receipt.contractAddress)
                  const interfaces = ethereum.getContractInterfaces(transactionWithContract.receipt.contractAddress, opcode)
                  const data = await ethereum.getContractDataByInterfaces(transactionWithContract.receipt.contractAddress, interfaces)
                  log(`[#${blockNumber}][${transactionWithContract.receipt.contractAddress}] interfaces ${interfaces.join(', ')}`)
                  addressesForSave.push({
                    instanceOf: interfaces,
                    data,
                    opcode,
                    address: transactionWithContract.receipt.contractAddress,
                    type: AddressesRepository.ADDRESS_TYPE_CONTRACT,
                    createdAt: new Date(block.timestamp * 1000)
                  })
                }

                await AddressesRepository.update(addressesForSave, ['address'], true)
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
