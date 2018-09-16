require('dotenv').load()
const exec = require('child_process')
const glob = require('glob')
const fs = require('fs')
const path = require('path')
const log = require('debug')('interfaces-generator')
const web3 = require('web3')
const repositories = require('../../db/repositories')
const ARTIFACTS_DIR = path.join(__dirname, '/artifacts')
const CONTRACTS_DIR = path.join(__dirname, '/contracts')
const TYPES_DIR = path.join(__dirname, '/types')
const contractsNames = glob.sync('**/*.sol', { cwd: CONTRACTS_DIR }).map(file => path.basename(file, '.sol'))

function clean() {
  // Getting exists artifacts list
  log(`Collecting old artifacts files`)
  const files = glob.sync('*.json', { cwd: ARTIFACTS_DIR })

  // Clean directory
  log(`Clean artifacts directory`)
  files.forEach(file => fs.unlinkSync(path.join(ARTIFACTS_DIR, file)))
}

repositories.connect()
  .then(async ({ InterfacesRepository }) => {
    // Compile contracts artifacts
    for (let i = 0; i < contractsNames.length; i++) {
      const contractName = contractsNames[i]
      clean()

      log(`[${contractName}] Compile contract`)
      exec.execSync(`truffle compile ${contractName}`, { cwd: __dirname })

      // Remove not using artifacts
      log(`[${contractName}] Getting artifact`)
      const compiledFiles = glob.sync('*.json', { cwd: ARTIFACTS_DIR })
      const availableContractsArtifacts = compiledFiles.filter(file => {
        return contractName === path.basename(file, '.json')
      })

      // Analizing builded artifacts
      for (let a = 0; a < availableContractsArtifacts.length; a++) {
        const artifactFile = availableContractsArtifacts[a]
        const newArtifactData = {}
        const artifactData = require(path.join(ARTIFACTS_DIR, artifactFile))
        // add hashes to abi
        newArtifactData.contractName = artifactData.contractName
        newArtifactData.abi = artifactData.abi.map(method => {
          log(`[${contractName}][${method.name}] Generate method hash`)
          method._signature = `${method.name}(${method.inputs && method.inputs.map(input => input.type).join(',')})`
          method._hash = web3.utils.sha3(method._signature)
          if (method.type === 'function') {
            method._hash = method._hash.substring(0, 10)
          }
          return method
        })
        if (newArtifactData.abi.length) {
          fs.writeFileSync(path.join(TYPES_DIR, `${contractName}.json`), JSON.stringify(newArtifactData, null, 2))
          // save interdace to database
          await InterfacesRepository.update(newArtifactData, ['contractName'], true)
          log(`[${contractName}] save`)
        } else {
          log(`[${contractName}] No abi. Skipped`)
        }
      }
    }

    clean()

    log('Finish')
    process.exit()
  })
  .catch(error => log(error))
