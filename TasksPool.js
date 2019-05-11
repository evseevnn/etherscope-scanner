const log = require('debug')('scanner:TasksPool')
const amqp = require('amqplib')
const EventEmitter = require('events')

class TasksPool extends EventEmitter {
  constructor(topic) {
    super()
    this.topic = topic
  }

  /**
   * Connect to queue
   */
  async connect() {
    log('Trying connect to amqp queue')
    this.amqp = await amqp.connect(process.env.AMQP_URL)
    this.channel = await this.amqp.createChannel()
    this.queue = await this.channel.assertQueue(this.topic, { durable: true })
    log('Connected with amqp queue')
  }

  send(data) {
    this.channel.sendToQueue(
      this.topic,
      Buffer.from(JSON.stringify(data)),
      {
        deliveryMode: 2 // Make message persistent
      }
    )
  }

  subscribe() {
    log(`Subscribe on topic: ${this.topic}`)
    this.channel.prefetch(+process.env.MAX_WORKERS) // MAX tasks per worker
    this.channel.consume(this.topic, msg => {
      this.emit('data', msg)
    })
  }

  done(msg) {
    this.channel.ack(msg)
  }
}

module.exports = TasksPool
