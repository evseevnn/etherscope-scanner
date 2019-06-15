const log = require('debug')('balance-processing')
const bigNumber = require('bignumber.js')
const MAX_INCREMENTS_BEFORE_UPDATE = 10

module.exports = function ({ repositories, ethereum }) {
  const { AddressesRepository } = repositories
  return async function ({ from, to, amount, tokenAddress }) {
    try {
      // Need get address balance from database for update balance
      const addressesForReq = [from, to]
      const addressesFromDb = await AddressesRepository.find({ address: { $in: addressesForReq } }, { code: false }).toArray()

      // look on every address
      for (let i = 0; i < addressesForReq.length; i++) {
        const addressFromReq = addressesForReq[i]
        const addressFromDb = addressesFromDb.find(addressData => addressData.address === addressFromReq)
        const accountObject = (
          ({
            address,
            type = 'address',
            data,
            instanceOf,
            balance = 0,
            tokens = {},
            incrementUpdateCounter = 0
          }) => ({ address: addressFromReq, type, data, instanceOf, balance, tokens, incrementUpdateCounter })
        )(addressFromDb || {})

        // Increment counter of update balance counter
        accountObject.incrementUpdateCounter++

        // If it's update for token
        if (tokenAddress) {
          // Update token balance
          const [ contractData ] = await AddressesRepository.find({ address: tokenAddress }).toArray()
          if (accountObject.incrementUpdateCounter % MAX_INCREMENTS_BEFORE_UPDATE) {
            const contract = await ethereum.getContract(tokenAddress, contractData.abi)
            if (contract.instance['balanceOf']) {
              const balance = await contract.instance['balanceOf'].call({}, [accountObject.address])
              accountObject.tokens[tokenAddress] = {
                address: tokenAddress,
                data: contractData.data,
                value: balance.toString(10),
                updatedAt: new Date()
              }
            }
          } else {
            // i === 0 - from
            // i > 0 - to
            const amountForIncrement = +(i === 0 ? -amount : amount)

            // Should be update by increment operation
            accountObject.tokens[tokenAddress] = {
              address: tokenAddress,
              data: contractData.data,
              value: bigNumber(+(accountObject.tokens[tokenAddress] && accountObject.tokens[tokenAddress].value) || 0).plus(amountForIncrement).toString(),
              updatedAt: new Date()
            }
          }
        } else {
          // If address in Db
          if (accountObject.incrementUpdateCounter % MAX_INCREMENTS_BEFORE_UPDATE) {
            // Need update from network
            const balanceFromNetwork = await ethereum.getBalance(addressFromReq)
            accountObject.balance = balanceFromNetwork.toString()
          } else {
            // i === 0 - from
            // i > 0 - to
            const amountForIncrement = +(i === 0 ? -amount : amount)
            // Should be update by increment operation
            accountObject.balance = bigNumber(+accountObject.balance).plus(amountForIncrement).toString()
          }
        }

        // If account it's not contract, no need save data and instanceOf info
        if (accountObject.type !== 'contract') {
          delete accountObject.data
          delete accountObject.instanceOf
        }

        // Replace address in array to account object
        addressesForReq[i] = accountObject
      }

      // Update addresses data
      await AddressesRepository.update(addressesForReq, ['address'], true)
    } catch (error) {
      log(`Balance pocessing error`, error)
    }
    return true
  }
}
