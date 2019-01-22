const _ = require("lodash");
const dateFns = require("date-fns");

module.exports = async function insertCompare({
  knex,
  schema,
  trx,
  tableName,
  itemData,
  indices: queryKeys,
}) {
  let items = [];
  if (Array.isArray(itemData)) {
    items = itemData;
  } else {
    items[0] = itemData;
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

  // Create a string of the primary key values that can be used for filtering.
  function createPrimaryKey(item) {
    return Object.values(_.pick(item, queryKeys))
      .map(normalizeValue)
      .sort()
      .join("_");
  }

  const queryValues = items.reduce((values, item) => {
    const itemValues = _.pick(item, queryKeys);
    const key = Object.values(itemValues).join("_");

    if (!values.has(key)) {
      values.set(key, itemValues);
    }

    return values;
  }, new Map());

  let query = knex
    .withSchema(schema)
    .from(tableName)
    .select("*");

  for (const item of queryValues.values()) {
    query = query.orWhere((builder) => {
      _.each(item, (value, key) => {
        builder.where(key, value);
      });
    });
  }

  const existingRows = await query;

  // A collection of all the write operations we are gonna perform.
  const writeOps = [Promise.resolve()];

  // Determine which items can be simply inserted without causing conflicts
  // by comparing incoming and existing items.
  const itemsToUpdate = _.differenceBy(
    _.intersectionBy(items, existingRows, createPrimaryKey),
    existingRows,
    objectToNormalizedString,
  );

  const itemsToInsert = _.differenceBy(items, existingRows, createPrimaryKey);

  // Construct update queries for each item that has changed.
  itemsToUpdate.forEach((item) => {
    let updateQuery = knex(tableName)
      .withSchema(schema)
      .transacting(trx);

    for (const pk of queryKeys) {
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
