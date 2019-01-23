const _ = require("lodash");
const createPrimaryKey = require("./createPrimaryKey");

module.exports = async function importGeometryGroup({
  knex,
  schema,
  trx,
  tableName,
  group, // The array of objects in a group
  groupKeys, // Keys in the group objects that the objects are grouped by
}) {
  let items = [];
  if (Array.isArray(group)) {
    items = group;
  } else {
    items[0] = group;
  }

  const geometryData = _.pick(items[0], groupKeys);

  const createWhereQuery = () => {
    return trx(tableName)
      .withSchema(schema)
      .where(geometryData);
  };

  let existingGeometry = null;

  const points = _.orderBy(items, "index", "ASC").map(({ point }) => point);

  const geometry = {
    ...geometryData,
    geom: knex.raw(
      `ST_MakeLine(ARRAY[${points.map(() => "?").join(",")}])`,
      points,
    ),
    outliers: 0,
    min_likelihood: 0,
  };

  let updateQuery;

  if (existingGeometry) {
    console.log(
      `Updating geometry group ${createPrimaryKey(geometryData, groupKeys)}`,
    );
    updateQuery = createWhereQuery().update(geometry);
  } else {
    console.log(
      `Inserting geometry group ${createPrimaryKey(geometryData, groupKeys)}`,
    );

    updateQuery = trx(tableName)
      .withSchema(schema)
      .insert(geometry);
  }

  return updateQuery;
};
