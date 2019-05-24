module.exports = {
  cleanWeb4DecodedFields(result, removeDuplicates = false) {
    delete result.__length__
    Object.keys(result).forEach(field => {
      if (
        result[field] &&
        result[field].constructor &&
        result[field].constructor.name === 'BigNumber'
      ) {
        result[field] = result[field].toString(10)
      }

      if (field.startsWith('_')) {
        result[field.substring(1)] = result[field]
        delete result[field]
      } else if (removeDuplicates) {
        const duplicateField = Object.keys(result).find(anotherField => (anotherField !== field && result[anotherField] === result[field]))
        if (duplicateField) {
          if (isNaN(duplicateField) && !isNaN(field)) {
            delete result[field]
          } else if (!isNaN(duplicateField) && isNaN(field)) {
            delete result[duplicateField]
          }
        }
      }
    })

    return result
  }
}
