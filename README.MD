### Indexes

```
db.getCollection('addresses').createIndex({type: 1})
db.getCollection('addresses').createIndex({address: 1})
db.getCollection('blocks').createIndex({number: 1}, {unique: 1})
db.getCollection('blocks').createIndex({miner: 1})
db.getCollection('blocks').createIndex({author: 1})
db.getCollection('transactions').createIndex({from: 1})
db.getCollection('transactions').createIndex({to: 1})
db.getCollection('transactions').createIndex({'receipt.contractAddress': 1})
db.getCollection('transactions').createIndex({hash: 1}, {unique: 1})
```