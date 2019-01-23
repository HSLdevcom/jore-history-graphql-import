const _ = require("lodash");
const dateFns = require("date-fns");
const createPrimaryKey = require("./createPrimaryKey");

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
    console.log(`Inserting ${items.length} rows into ${tableName}`);
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

  // Ensure the data is unique by the primary keys
  items = _.uniqBy(items, (item) => createPrimaryKey(item, primaryIndices));

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

  // A collection of all the write operations we are gonna perform.
  const writeOps = [Promise.resolve()];
  const itemsToInsert = [];

  const createWhereQuery = (item, keys = []) => {
    const queryValues = keys.length !== 0 ? _.pick(item, keys) : item;
    const query = trx(tableName)
      .withSchema(schema)
      .where(queryValues);

    return query;
  };

  for (const item of items) {
    const existingItem = await createWhereQuery(item, primaryIndices).first(
      "*",
    );

    if (
      existingItem &&
      objectToNormalizedString(item) !== objectToNormalizedString(existingItem)
    ) {
      const updateQuery = createWhereQuery(item, primaryIndices).update(item);
      writeOps.push(updateQuery);
    } else {
      itemsToInsert.push(item);
    }
  }

  // Use batch insert for the items which are new to the DB.
  if (itemsToInsert.length !== 0) {
    writeOps.push(batchInsert(itemsToInsert));
  }

  console.log(
    `Inserting ${itemsToInsert.length} rows and updating ${items.length -
      itemsToInsert.length} rows in ${tableName}`,
  );

  return Promise.all(writeOps);
};
