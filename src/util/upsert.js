const _ = require("lodash");
const createPrimaryKey = require("./createPrimaryKey");

module.exports = async function upsert({
  knex,
  schema,
  trx,
  tableName,
  itemData,
  indices: primaryIndices = [],
  constraint = "",
}) {
  let items = [];
  if (Array.isArray(itemData)) {
    items = itemData;
  } else {
    items[0] = itemData;
  }

  const tableId = `${schema}.${tableName}`;

  function batchInsert(rows) {
    return knex.batchInsert(tableId, rows, 1000).transacting(trx);
  }

  // Just insert if we don't have any indices
  if (primaryIndices.length === 0) {
    console.log(`Inserting ${items.length} rows into ${tableName}`);
    return batchInsert(items);
  }

  // Ensure the data is unique by the primary keys
  items = _.uniqBy(items, (item) => createPrimaryKey(item, primaryIndices));
  const itemCount = items.length;

  // Get the set of keys for all items from the first item.
  // All items should have the same keys.
  const itemKeys = Object.keys(items[0]);

  // Create a string of placeholder values (?,?,?) for each item we want to insert
  const valuesPlaceholders = [];
  const placeholderRow = itemKeys.map(() => "?").join(",");

  for (let i = 0; i < itemCount; i++) {
    valuesPlaceholders.push(`(${placeholderRow})`);
  }

  // Collect all values to insert from all objects in a one-dimensional array.
  // Ensure that each key has a value.
  const insertValues = items.reduce((values, item) => {
    const itemValues = itemKeys.reduce((valuesArray, key) => {
      valuesArray.push(_.get(item, key, ""));
      return valuesArray;
    }, []);

    return [...values, ...itemValues];
  }, []);

  // Create the string of update values for the conflict case
  const updateValues = itemKeys
    .filter((key) => !primaryIndices.includes(key)) // Don't update primary indices
    .map((key) => knex.raw("?? = EXCLUDED.??", [key, key]).toString())
    .join(",\n");

  const onConflictKeys = !constraint
    ? `(${primaryIndices.map(() => "??").join(",")})`
    : "ON CONSTRAINT ??";

  const upsertQuery = `
INSERT INTO ?? (${itemKeys.map(() => "??").join(",")})
VALUES ${valuesPlaceholders.join(",")}
ON CONFLICT ${onConflictKeys} DO UPDATE SET
${updateValues};
`;
  const upsertBindings = [
    tableId,
    ...itemKeys,
    ...insertValues,
    ...(!constraint ? primaryIndices : [constraint]),
  ];

  console.log(`Inserting or updating ${items.length} rows in ${tableName}`);

  return trx.raw(upsertQuery, upsertBindings);
};
