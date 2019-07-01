module.exports = {
  apps: [
    {
      name: 'blocks-listner',
      script: './index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      args: '--expose-gc'
    },
    {
      name: 'blocks-processing',
      script: './ethereum/workers/blocks/index.js',
      instances: 2,
      exec_mode: 'fork',
      autorestart: true,
      args: '--expose-gc',
      env: {
        MAX_WORKERS: 4
      }
    },
    {
      name: 'contracts-processing',
      script: './ethereum/workers/contracts/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      args: '--expose-gc'
    }
  ]
}
