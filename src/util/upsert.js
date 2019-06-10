import _, { compact } from "lodash";
import { createPrimaryKey } from "./createPrimaryKey";

// "Upsert" function for PostgreSQL. Inserts or updates lines in bulk. Insert if
// the primary key for the line is available, update otherwise.

export async function upsert({
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
  } else if (itemData) {
    items = [itemData];
  }

  items = compact(items);

  if (items.length === 0) {
    return Promise.resolve();
  }

  // Prepend the schema name to the table. This is more convenient in raw queries
  // and batch queries where Knex doesn't seem to use the withSchema function.
  const tableId = `${schema}.${tableName}`;

  function batchInsert(rows) {
    if (trx) {
      return knex.batchInsert(tableId, rows, 1000).transacting(trx);
    }

    return knex.batchInsert(tableId, rows, 1000);
  }

  // Just insert if we don't have any indices
  if (primaryIndices.length === 0) {
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

  // Get the keys that the ON CONFLICT should check for
  // If a constraint is set, choose that.
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

  const dbInterface = trx || knex;
  return dbInterface.raw(upsertQuery, upsertBindings);
}
