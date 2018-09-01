const addresses = {}

const lineReader = require('readline').createInterface({
  input: require('fs').createReadStream(process.env.DUMP_FILE)
})

lineReader.on('line', function (line) {
  try {
    const json = JSON.parse(line)

    // check document exist
    if (addresses[json.address]) {
      // if current document has opcode but what we save without him
      if (json.opcode) {
        addresses[json.address] = { _id: json._id.$oid, opcode: true }
      }
    } else {
      addresses[json.address] = { _id: json._id.$oid, opcode: json.opcode.toString().startsWith('0 ') }
    }
  } catch (error) {
    console.log(error.toString())
    process.exit()
  }
})

const fs = require('fs')
fs.unlinkSync(process.env.DUMP_OUTPUT_FILE)

lineReader.on('close', () => {
  // Start reading again and write data to file
  const lineReaderForWrite = require('readline').createInterface({
    input: require('fs').createReadStream(process.env.DUMP_FILE)
  })

  lineReaderForWrite.on('line', function (line) {
    try {
      const json = JSON.parse(line)
      if (addresses[json.address] && json._id.$oid === addresses[json.address]._id) {
        fs.appendFileSync(process.env.DUMP_OUTPUT_FILE, line)
      }
    } catch (error) {
      console.log(error.toString())
      process.exit()
    }
  })

  lineReaderForWrite.on('close', () => process.exit())
})
