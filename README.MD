### Indexes

```
db.getCollection('accountsDevices').createIndex({'address': 1}, {background: true})
db.getCollection('accountsDevices').createIndex({'address': 1, 'deviceId': 1}, {unique: 1, background: true})
db.getCollection('interfaces').createIndex({'contractName': 1}, {unique: 1, background: true})
db.getCollection('interfaces').createIndex({'abi.name': 1}, {background: true})
db.getCollection('addresses').createIndex({'capitalization': 1}, {background: true})
db.getCollection('addresses').createIndex({'data.symbol': 1}, {background: true})
db.getCollection('addresses').createIndex({type: 1}, {background: true})
db.getCollection('addresses').createIndex({address: 1}, {unique : true, background: true})
db.getCollection('addresses').createIndex({instanceOf: 1}, {background: true})
db.getCollection('addresses').createIndex({ 'data.name': 'text' }, {background: true})
db.getCollection('addresses').createIndex({ address: 1, updatedAt: -1 }, {background: true})
db.getCollection('addresses').createIndex({incrementUpdateCounter: -1}, { background: true })
db.getCollection('blocks').createIndex({number: -1}, {unique: 1, background: true})
db.getCollection('blocks').createIndex({miner: 1}, {background: true})
db.getCollection('blocks').createIndex({author: 1}, {background: true})
db.getCollection('transactions').createIndex({'from.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'to.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.data.from.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.data.to.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.address.address': 1}, {background: true})
db.getCollection('transactions').createIndex({'events.name': 1}, {background: true})
db.getCollection('transactions').createIndex({addresses: 1}, {background: true})
db.getCollection('transactions').createIndex({hash: 1}, {unique: 1, background: true})
db.getCollection('transactions').createIndex({blockNumber: -1}, {background: true})
db.getCollection('transactions').createIndex({blockNumber: -1, transactionIndex: -1}, {background: true})
db.getCollection('transactions').createIndex({createdAt: -1}, { background: true })
db.getCollection('transactions').createIndex({addedAt: -1}, { background: true })
db.getCollection('transactions').createIndex({isContractProcessed: 1}, {background: true})
```

# Parity
 
```
sudo mkdir /ethereum

screen -L parity\
  --mode active\
  --ws-origins all\
  --ws-hosts all\
  --ws-interface all\
  --jsonrpc-interface all\
  --jsonrpc-cors all\
  --base-path /ethereum/data\
  --no-warp\
  --no-hardware-wallets\
  --min-gas-price 20000000000\
  --no-serve-light\
  --tracing on\
  --db-compaction ssd\
  --max-peers 100\
  --snapshot-peers 50\
  --min-peers 50\
  --cache-size 6144\
  --ipc-path /ethereum/parity.ipc\
  --unsafe-expose
```


На сервере где находится Parity надо запустить воркер который будет просто брать и класть задачи в рабит
1
 Parity

2
 RabbitMQ
 Worker for add to rabbitMQ
 Worker Blocks
 Worker Contracts

3
 MongoDB
 GQL
