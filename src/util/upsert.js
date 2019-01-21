const _ = require("lodash");
const dateFns = require("date-fns");

/**
 * Perform an "Upsert" using the "INSERT ... ON CONFLICT ... " syntax in PostgreSQL 9.5
 * @link http://www.postgresql.org/docs/9.5/static/sql-insert.html
 * @author https://github.com/adnanoner
 * @source https://gist.github.com/adnanoner/b6c53482243b9d5d5da4e29e109af9bd
 * inspired by: https://gist.github.com/plurch/118721c2216f77640232
 * @param {string} tableName - The name of the database table
 * @param {string} indexColumns - The column in the table which has a unique index constraint
 * @param {Object} itemData - a hash of properties to be inserted/updated into the row
 * @returns {knexQuery} - A knexQuery
 */

module.exports = async function upsert({
  knex,
  schema,
  trx,
  tableName,
  itemData,
  indices: primaryIndices = [],
}) {
  let items = [];
  if (Array.isArray(itemData)) {
    items = itemData;
  } else {
    items[0] = itemData;
  }

  function batchInsert(rows) {
    return knex
      .batchInsert(`${schema}.${tableName}`, rows, 1000)
      .transacting(trx);
  }

  // Just insert if we don't have any indices
  if (primaryIndices.length === 0) {
    console.log(`Importing ${items.length} rows into ${tableName}`);
    return batchInsert(items);
  }

  function normalizeValue(val) {
    if (val instanceof Date) {
      return dateFns.format(val, "YYYY-MM-DD");
    }

    if (val === "1" || val === "0") {
      return !!parseInt(val, 10);
    }

    return _.trim(_.toString(val));
  }

  // Create a string of the primary key values that can be used for filtering.
  function createPrimaryKey(item) {
    return Object.values(_.pick(item, primaryIndices))
      .map(normalizeValue)
      .sort()
      .join("_");
  }

  // Ensure the data is unique by the primary keys
  items = _.uniqBy(items, createPrimaryKey);

  const itemKeys = Object.keys(items[0]);

  const exclusions = itemKeys
    .filter((key) => !primaryIndices.includes(key))
    .map((key) => trx.raw("?? = EXCLUDED.??", [key, key]).toString())
    .join(",\n");

  const hasConflicts = _.difference(itemKeys, primaryIndices).length !== 0;

  const valuesPreparedString = items
    .map(
      (item) =>
        `(${Object.keys(item)
          .map(() => "?")
          .join(",")})`,
    )
    .join(",");

  const preparedValues = _.flatten(items.map((item) => Object.values(item)));

  // if we have an array of conflicting targets to ignore process it
  let conflict = "";

  if (primaryIndices && primaryIndices.length !== 0 && hasConflicts) {
    conflict = `(${primaryIndices.map(() => "??").join(",")})`;
  }

  const itemKeysPlaceholders = itemKeys.map(() => "??").join(",");

  const rawString = `
INSERT INTO ?? (${itemKeysPlaceholders})
VALUES ${valuesPreparedString}
ON CONFLICT ${conflict} DO UPDATE SET
${exclusions}
RETURNING *;
`;

  const bindings = [
    `${schema}.${tableName}`,
    ...itemKeys,
    ...preparedValues,
    ...primaryIndices,
  ];

  console.log(`Importing or updating ${items.length} rows into ${tableName}`);

  return trx.raw(rawString, bindings);
};
