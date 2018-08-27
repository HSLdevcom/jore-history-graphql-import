/**
 * Perform an "Upsert" using the "INSERT ... ON CONFLICT ... " syntax in PostgreSQL 9.5
 * @link http://www.postgresql.org/docs/9.5/static/sql-insert.html
 * @author https://github.com/adnanoner
 * @source https://gist.github.com/adnanoner/b6c53482243b9d5d5da4e29e109af9bd
 * inspired by: https://gist.github.com/plurch/118721c2216f77640232
 * @param {string} tableName - The name of the database table
 * @param {string} conflictTarget - The column in the table which has a unique index constraint
 * @param {Object} itemData - a hash of properties to be inserted/updated into the row
 * @returns {knexQuery} - A knexQuery
 */
module.exports = async function upsert({
  db,
  tableName,
  itemData,
  conflictTarget,
}) {
  let itemsArray = [];
  if (Array.isArray(itemData)) {
    itemsArray = itemData;
  } else {
    itemsArray[0] = itemData;
  }
  const itemKeys = Object.keys(itemsArray[0]);

  const exclusions = itemKeys
    .filter((c) => c !== conflictTarget)
    .map((c) => db.raw("?? = EXCLUDED.??", [c, c]).toString())
    .join(",\n");

  let valuesPreparedString = "";
  let preparedValues = [];
  itemsArray.forEach((item) => {
    valuesPreparedString += "(";
    for (let i = 0; i < itemKeys.length - 1; i += 1) {
      valuesPreparedString += "?, ";
    }
    valuesPreparedString += "?), ";
    preparedValues = preparedValues.concat(Object.values(item));
  });
  // Remove last trailing comma
  valuesPreparedString = valuesPreparedString.replace(/,\s*$/, "");

  // if we have an array of conflicting targets to ignore process it
  let conflict = "";
  if (conflictTarget) {
    conflict += "(";
    if (Array.isArray(conflictTarget)) {
      for (let i = 0; i < conflictTarget.length - 1; i += 1) {
        conflict += "??, ";
      }
      preparedValues = preparedValues.concat(conflictTarget);
    } else {
      preparedValues.push(conflictTarget);
    }
    conflict += "??)";
  }

  const itemKeysPlaceholders = itemKeys.map(() => "??").join(",");

  const query = db.raw(
    `
INSERT INTO ?? (${itemKeysPlaceholders})
VALUES ${valuesPreparedString}
ON CONFLICT ${conflict} DO UPDATE SET
${exclusions}
RETURNING *;
    `.trim(),
    [tableName, ...itemKeys, ...preparedValues],
  );

  return query;
};
