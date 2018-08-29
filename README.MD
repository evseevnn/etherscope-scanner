### Indexes

```
db.createCollection('transactions', { capped: true, size: 1073741824 })

db.getCollection('addresses').createIndex({type: 1}, {background: true})
db.getCollection('addresses').createIndex({address: 1}, {background: true})
db.getCollection('addresses').createIndex({instanceOf: 1}, {background: true})
db.getCollection('blocks').createIndex({number: 1}, {unique: 1, background: true})
db.getCollection('blocks').createIndex({miner: 1}, {background: true})
db.getCollection('blocks').createIndex({author: 1}, {background: true})
db.getCollection('transactions').createIndex({from: 1}, {background: true})
db.getCollection('transactions').createIndex({to: 1}, {background: true})
db.getCollection('transactions').createIndex({'receipt.contractAddress': 1}, {background: true})
db.getCollection('transactions').createIndex({hash: 1}, {unique: 1, background: true})
db.getCollection('transactions').createIndex({blockNumber: 1}, {background: true})
```