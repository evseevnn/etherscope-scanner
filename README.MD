### Indexes

```
db.getCollection('interfaces').createIndex({'contractName': 1}, {unique: 1, background: true})
db.getCollection('interfaces').createIndex({'abi.name': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.dayTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.dayTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.weekTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.weekTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.monthTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.monthTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'capitalization': 1}, {background: true})
db.getCollection('addresses').createIndex({'data.symbol': 1}, {background: true})
db.getCollection('addresses').createIndex({type: 1}, {background: true})
db.getCollection('addresses').createIndex({address: 1}, {unique : true, background: true})
db.getCollection('addresses').createIndex({instanceOf: 1}, {background: true})
db.getCollection('addresses').createIndex({ 'data.name': 'text' }, {background: true})
db.getCollection('addresses').createIndex({ address: 1, = }, {background: true})
db.getCollection('blocks').createIndex({transactions: 1}, {background: true})
db.getCollection('blocks').createIndex({number: -1}, {unique: 1, background: true})
db.getCollection('blocks').createIndex({miner: 1}, {background: true})
db.getCollection('blocks').createIndex({author: 1}, {background: true})
db.getCollection('transactions').createIndex({'from.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'to.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.address.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.name': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.data.from.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.data.to.address': 1}, {background: true})
db.getCollection('transactions').createIndex({hash: 1}, {unique: 1, background: true})
db.getCollection('transactions').createIndex({blockNumber: -1}, {background: true})
db.getCollection('transactions').createIndex({blockNumber: -1, transactionIndex: -1}, {background: true})
db.getCollection('transactions').createIndex({createdAt: -1}, {background: true, expireAfterSeconds: 2678400, partialFilterExpression: { isContractProcessed: true, isBalancesUpdated: true }})
db.getCollection('transactions').createIndex({addedAt: -1}, {background: true, expireAfterSeconds: 10800, partialFilterExpression: { cache: true }})
db.getCollection('transactions').createIndex({processed: 1}, {background: true})
```

# Parity

```
screen -L parity\
  --mode active\
  --ws-origins all\
  --ws-hosts all\
  --ws-interface all\
  --jsonrpc-interface all\
  --jsonrpc-cors all\
  --base-path /mnt/volume_ams3_01/ethereum\
  --no-warp\
  --no-hardware-wallets\
  --min-gas-price 3000000000\
  --no-serve-light\
  --fat-db on\
  --tracing on\
  --db-compaction ssd\
  --cache-size 4096
```