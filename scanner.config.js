module.exports = {
  apps: [{
    name: 'scanner',
    script: 'index.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    autorestart: true
  },
  {
    name: 'blocks-listner',
    script: './blockchain/ethereum/listeners/blocks.js',
    instances: 2,
    exec_mode: 'fork',
    autorestart: true
  }]
}
