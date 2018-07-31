module.exports = {
  ethereum: {
    get Account() { return require('./ethereum/Account') },
    get Block() { return require('./ethereum/Block') },
    get Contract() { return require('./ethereum/Contract') },
    get ContractERC20() { return require('./ethereum/ContractERC20') },
    get Log() { return require('./ethereum/Log') },
    get Receipt() { return require('./ethereum/Receipt') },
    get Transaction() { return require('./ethereum/Transaction') }
  }
}
