module.exports = {
  apps: [{
    name: 'scanner',
    script: 'index.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  },
  {
    name: 'worker',
    script: './nsq/worker.js'
  }]
}
