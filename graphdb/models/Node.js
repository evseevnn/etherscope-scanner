let nodeCounter = 0

class Node {
  constructor(data) {
    this.uid = data.uid || `_:${this._type}_${++nodeCounter}`
    this._fields.forEach(key => {
      this[key] = data[key]
    })
  }

  get _fields() {
    throw new Error('Not implemented')
  }

  get _type() {
    throw new Error('Not implemented')
  }

  /**
   * Make link to another object
   * @param {String} name name of link
   * @param {Node} obj Node object for link
   * @param {Boolean} fullyInsert If true object will include fully
   */
  link(name, obj, fullyInsert = false) {
    if (!(obj instanceof Node)) {
      throw new Error('Make link possible only between two Node objects')
    }

    let linkData = obj.toJSON()
    if (!fullyInsert) {
      linkData = { uid: linkData.uid }
    }

    if (this[name]) {
      if (!Array.isArray(this[name])) {
        this[name] = [this[name]]
      }
      this[name].push(linkData)
    } else {
      this[name] = linkData
    }
  }

  toJSON() {
    throw new Error('Not implemented')
  }
}

module.exports = Node
