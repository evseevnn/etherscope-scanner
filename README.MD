### Capped collections
```
db.createCollection('transactions', { capped: true, size: 53687091200 }) // 50Gb
```

### Indexes

```
db.getCollection('addresses').createIndex({'statistics.dayTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.dayTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.weekTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.weekTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.monthTxIn': 1}, {background: true})
db.getCollection('addresses').createIndex({'statistics.monthTxOut': 1}, {background: true})
db.getCollection('addresses').createIndex({'data.symbol': 1}, {background: true})
db.getCollection('addresses').createIndex({type: 1}, {background: true})
db.getCollection('addresses').createIndex({address: 1}, {unique : true, background: true})
db.getCollection('addresses').createIndex({instanceOf: 1}, {background: true})
db.getCollection('blocks').createIndex({number: -1}, {unique: 1, background: true})
db.getCollection('blocks').createIndex({miner: 1}, {background: true})
db.getCollection('blocks').createIndex({author: 1}, {background: true})
db.getCollection('transactions').createIndex({from: 1}, {background: true})
db.getCollection('transactions').createIndex({to: 1}, {background: true})
db.getCollection('transactions').createIndex({'receipt.contractAddress': 1}, {background: true})
db.getCollection('transactions').createIndex({hash: 1}, {unique: 1, background: true})
db.getCollection('transactions').createIndex({blockNumber: -1}, {background: true})
db.getCollection('transactions').createIndex({timestamp: -1}, {background: true})
```