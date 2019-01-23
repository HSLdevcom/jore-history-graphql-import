const _ = require("lodash");

module.exports = async function getPrimaryConstraint(
  knex,
  tableName,
  schemaName = "public",
) {
  const { rows } = await knex.raw(
    `SELECT con.*
     FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel
                       ON rel.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace nsp
                       ON nsp.oid = connamespace
     WHERE nsp.nspname = ?
       AND rel.relname = ?;`,
    [schemaName, tableName],
  );

  // Only interested in unique constraints
  return _.get(rows.filter((row) => row.contype === "u"), "[0].conname", null);
};
