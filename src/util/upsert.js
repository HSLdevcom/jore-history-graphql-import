const _ = require("lodash");

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
  conflictTarget = [],
}) {
  let itemsArray = [];
  if (Array.isArray(itemData)) {
    itemsArray = itemData;
  } else {
    itemsArray[0] = itemData;
  }

  if (conflictTarget.length !== 0) {
    itemsArray = _.uniqBy(itemsArray, (item) =>
      Object.values(_.pick(item, ...conflictTarget)).join("__"),
    );
  }

  const itemKeys = Object.keys(itemsArray[0]);
  const conflictKeys = Array.isArray(conflictTarget)
    ? conflictTarget
    : [conflictTarget];

  const exclusions = itemKeys
    .filter((key) => !conflictKeys.includes(key))
    .map((key) => db.raw("?? = EXCLUDED.??", [key, key]).toString())
    .join(",\n");

  const hasConflicts = _.difference(itemKeys, conflictKeys).length !== 0;

  const valuesPreparedString = itemsArray
    .map(
      (item) =>
        `(${Object.keys(item)
          .map(() => "?")
          .join(",")})`,
    )
    .join(",");

  const preparedValues = _.flatten(
    itemsArray.map((item) => Object.values(item)),
  );

  // if we have an array of conflicting targets to ignore process it
  let conflict = "";

  if (conflictKeys && conflictKeys.length !== 0 && hasConflicts) {
    conflict = `(${conflictKeys.map(() => "??").join(",")})`;
  }

  const itemKeysPlaceholders = itemKeys.map(() => "??").join(",");

  let rawString = `INSERT INTO ?? (${itemKeysPlaceholders})
VALUES ${valuesPreparedString}
ON CONFLICT ${conflict} DO UPDATE SET
${exclusions}
RETURNING *;`;

  if (!hasConflicts || !conflict) {
    rawString = `INSERT INTO ?? (${itemKeysPlaceholders})
VALUES ${valuesPreparedString}
ON CONFLICT DO NOTHING
RETURNING *;`;
  }

  const bindings = [tableName, ...itemKeys, ...preparedValues, ...conflictKeys];
  return db.raw(rawString, bindings);
};
