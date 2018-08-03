const log = require('debug')('scanner:TasksPool')
const { Writer, Reader } = require('nsqjs')

// Writer section
let nsqWriter
const writerOptions = {
  tls: process.env.NSQ_WRITER_TLS || false,
  tlsVerification: process.env.NSQ_WRITER_TLS_VERIFICATION || true,
  deflate: process.env.NSQ_WRITER_DEFLATE || false,
  deflateLevel: +process.env.NSQ_WRITER_DEFLATE_LEVEL || 6,
  snappy: process.env.NSQ_WRITER_SNAPPY || false,
  clientId: process.env.NSQ_WRITER_CLIENT_ID || null
}

// Reader section
let nsqReader
const readerOptions = {
  maxInFlight: +process.env.NSQ_READER_MAX_IN_FLIGHT || 1,
  heartbeatInterval: +process.env.NSQ_READER_HEARTBEAT_INTERVAL || 60,
  maxBackoffDuration: +process.env.NSQ_READER_MAX_BACKOFF_DURATION || 128,
  maxAttempts: +process.env.NSQ_READER_MAX_ATTEMPTS || 0,
  requeueDelay: +process.env.NSQ_READER_REQUEUE_DELAY || 90,
  nsqdTCPAddresses: process.env.NSQ_READER_NSQD_TCP_ADDRESSES.split(','),
  lookupdHTTPAddresses: process.env.NSQ_READER_LOOKUPD_HTTP_ADDRESSES.split(','),
  lookupdPollInterval: +process.env.NSQ_READER_LOOKUPD_POLL_INTERVAL || 60,
  lookupdPollJitter: +process.env.NSQ_READER_LOOKUPD_POLL_JITTER || 0.3,
  tls: process.env.NSQ_READER_TLS || false,
  tlsVerification: process.env.NSQ_READER_TLS_VERIFICATION || true,
  deflate: process.env.NSQ_READER_DEFLATE || false,
  deflateLevel: +process.env.NSQ_READER_DEFLATE_LEVEL || 6,
  snappy: process.env.NSQ_READER_SNAPPY || false,
  authSecret: process.env.NSQ_READER_AUTH_SECRET || null,
  outputBufferSize: process.env.NSQ_READER_OUTPUT_BUFFER_SIZE || null,
  outputBufferTimeout: process.env.NSQ_READER_OUTPUT_BUFFER_TIMEOUT || null,
  messageTimeout: process.env.NSQ_READER_MESSAGE_TIMEOUT || null,
  sampleRate: process.env.NSQ_READER_SAMPLE_RATE || null,
  clientId: process.env.NSQ_READER_CLIENT_ID || null
}

class TasksPool {
  constructor(name) {
    this.name = name
  }

  connectAsWriter() {
    nsqWriter = new Writer(process.env.NSQ_WRITER_HOST, process.env.NSQ_WRITER_PORT, writerOptions)

    nsqWriter.on('closed', () => {
      log('Writer closed')
    })

    return new Promise((resolve) => {
      nsqWriter.connect()
      nsqWriter.on('ready', () => {
        log('Task pool writer is ready')
        resolve()
      })
    })
  }

  send(data) {
    nsqWriter.publish(this.name, data, (error) => {
      if (error) {
        log(error)
      }
    })
  }

  connectAsReader(callback) {
    nsqReader = new Reader(this.name, 'scanner', readerOptions)
    nsqReader.connect()
    let touchTimeout
    nsqReader
          .on('discard', (error) => log(error))
          .on('error', (error) => log(error))
          .on('nsqd_connected', () => log('Task pool reader is ready'))
          .on('message', (msg) => {
            const touch = () => {
              if (!msg.hasResponded) {
                msg.touch()

                // Touch the message again a second before the next timeout.
                touchTimeout = setTimeout(touch, msg.timeUntilTimeout() - 1000)
              }
            }

            touchTimeout = setTimeout(touch, msg.timeUntilTimeout() - 1000)

            callback(JSON.parse(msg.body.toString()), () => {
              clearTimeout(touchTimeout)
              msg.finish()
            })
          })
  }
}

module.exports = TasksPool
