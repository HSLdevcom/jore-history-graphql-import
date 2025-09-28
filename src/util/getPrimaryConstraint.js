import { get } from 'lodash'

export async function getPrimaryConstraint(knex, tableName, schemaName = 'public') {
  const { rows } = await knex.raw(
    `SELECT con.*
     FROM pg_catalog.pg_constraint con
            INNER JOIN pg_catalog.pg_class rel
                       ON rel.oid = con.conrelid
            INNER JOIN pg_catalog.pg_namespace nsp
                       ON nsp.oid = connamespace
     WHERE nsp.nspname = ?
       AND rel.relname = ?;`,
    [schemaName, tableName]
  )

  // Only interested in primary constraints
  return get(rows.filter((row) => row.conname.includes('pkey')), '[0].conname', null)
}
