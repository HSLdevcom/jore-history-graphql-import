import addDays from 'date-fns/add_days/index.js'
import endOfDay from 'date-fns/end_of_day/index.js'
import isBefore from 'date-fns/is_before/index.js'
import parse from 'date-fns/parse/index.js'
import isValid from 'date-fns/is_valid/index.js'
import { intersection } from 'lodash-es'
import schema from '../schema.js'

// Remove rows which have a date field and the date is more than one day in the
// future.

let dateFields = []

for (let table of Object.values(schema)) {
  for (let field of table.fields) {
    if (
      field.type === 'date' &&
      !field.name.endsWith('end') &&
      !dateFields.includes(field.name)
    ) {
      dateFields.push(field.name)
    }
  }
}

export function createFutureRowsFilter() {
  let currentDate = endOfDay(addDays(new Date(), 4))

  return (item) => {
    let itemKeys = Object.keys(item)
    let itemDateFields = intersection(itemKeys, dateFields)

    if (itemDateFields.length === 0) {
      return true
    } else {
      let useField = itemDateFields[0]
      let fieldValue = item[useField]
      let dateValue = parse(fieldValue)

      if (fieldValue && isValid(dateValue)) {
        return isBefore(dateValue, currentDate)
      }

      return false
    }
  }
}
