const _ = require("lodash");
const dateFns = require("date-fns");
const { performance } = require("perf_hooks");

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

  // Just insert if we have no clue about any indices
  if (primaryIndices.length === 0) {
    console.log(`Importing ${items.length} rows into ${tableName}`);

    return knex
      .batchInsert(`${schema}.${tableName}`, items, 1000)
      .transacting(trx);
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

  // Create a string representation of an item that is as normalized as possible.
  // Used to compare a new item and a fetched item to determine if an update needs to be done.
  function objectToNormalizedString(item) {
    const values = [];
    const keys = Object.keys(item).sort();

    for (const key of keys) {
      let val = item[key];
      val = normalizeValue(val);
      values.push(`${key}:${val}`);
    }

    return values.join("_");
  }

  let query = knex
    .withSchema(schema)
    .from(tableName)
    .select("*");

  for (const item of items) {
    query = query.orWhere((builder) => {
      for (const key of primaryIndices) {
        builder.where(key, item[key]);
      }
    });
  }

  const existingRows = await query;

  // A collection of all the write operations we are gonna perform.
  const writeOps = [Promise.resolve()];

  // Determine which items can be simply inserted without causing conflicts
  // by comparing incoming and existing items by primary key.
  const itemsToInsert = _.differenceBy(items, existingRows, createPrimaryKey);

  // ...and which items needs to be updated. As an additional measure, determine
  // which items have actually changed to prevent redundant update operations.
  const existingItems = _.intersectionBy(items, existingRows, createPrimaryKey);
  const itemsToUpdate = _.differenceBy(
    existingItems,
    existingRows,
    objectToNormalizedString,
  );

  // Construct update queries for each item that has changed.
  itemsToUpdate.forEach((item) => {
    let updateQuery = knex(tableName)
      .withSchema(schema)
      .transacting(trx);

    for (const pk of primaryIndices) {
      updateQuery = updateQuery.where(pk, item[pk]);
    }

    updateQuery = updateQuery.update(item);
    writeOps.push(updateQuery);
  });

  // Use batch insert for the items which are new to the DB.
  if (itemsToInsert.length !== 0) {
    writeOps.push(
      knex
        .batchInsert(`${schema}.${tableName}`, itemsToInsert, 1000)
        .transacting(trx),
    );
  }

  console.log(
    `Importing ${itemsToInsert.length} rows and updating ${
      itemsToUpdate.length
    } rows in ${tableName}`,
  );

  // Return the promise so that the transaction can eventually close.
  return Promise.all(writeOps);
};
