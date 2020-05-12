import startOfDay from "date-fns/start_of_day";
import addDays from "date-fns/add_days";
import addHours from "date-fns/add_hours";
import isBefore from "date-fns/is_before";
import parse from "date-fns/parse";
import isValid from "date-fns/is_valid";
import { intersection } from "lodash";
import schema from "../schema";

// Remove rows which have a date field and the date is more than one day in the
// future.

let currentDate = addHours(startOfDay(addDays(new Date(), 1)), 3);
let dateFields = [];

for (let table of Object.values(schema)) {
  for (let field of table.fields) {
    if (
      field.type === "date" &&
      !field.name.endsWith("end") &&
      !dateFields.includes(field.name)
    ) {
      dateFields.push(field.name);
    }
  }
}

export function removeFutureRows(item) {
  let itemKeys = Object.keys(item);
  let itemDateFields = intersection(itemKeys, dateFields);

  if (itemDateFields.length !== 0) {
    let useField = itemDateFields[0];
    let dateValue = parse(item[useField]);

    if (dateValue && isValid(dateValue)) {
      return isBefore(dateValue, currentDate);
    }

    return false;
  }

  return true;
}
