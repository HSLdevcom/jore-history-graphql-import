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

  const hasConflicts = _.difference(itemKeys, conflictTarget).length !== 0;

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
  let conflictKeys = [];

  if (conflictTarget) {
    if (Array.isArray(conflictTarget) && conflictTarget.length !== 0) {
      conflict = `(${conflictTarget.map(() => "??").join(",")})`;
      conflictKeys = conflictKeys.concat(conflictTarget);
    } else if (typeof conflictTarget === "string") {
      conflict = "(??)";
      conflictKeys.push(conflictTarget);
    }
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

  const query = db.raw(rawString, [
    tableName,
    ...itemKeys,
    ...preparedValues,
    ...conflictKeys,
  ]);

  return query;
};
