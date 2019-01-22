module.exports = async function prefetch({ knex, schema, tableName }) {
  const query = knex
    .withSchema(schema)
    .from(tableName)
    .select("*");

  return query;
};
