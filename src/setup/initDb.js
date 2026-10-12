const { createTables, createForeignKeys } = require('./createDb')
const fs = require('fs-extra')
const path = require('path')
const tables = require('../schema')
const { pick } = require('lodash-es')

async function initDb(knex) {
  try {
    const createSchemaSQL = await fs.readFile(path.join(__dirname, 'createSchema.sql'), 'utf8')

    await knex.raw(createSchemaSQL)

    const createdTables = await createTables('jore', tables, knex)

    const optionalDepartureFields = tables.departure.fields.filter(({ optional }) => optional)

    for (const { name, defaultTo } of optionalDepartureFields) {
      const hasColumn = await knex.schema.withSchema('jore').hasColumn('departure', name)

      if (!hasColumn) {
        await knex.schema.withSchema('jore').alterTable('departure', (table) => {
          table.integer(name).notNullable().defaultTo(defaultTo)
        })
      }
    }

    if (createdTables.length !== 0) {
      await createForeignKeys('jore', pick(tables, createdTables), knex)
    }

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, 'createFunctions.sql'),
      'utf8'
    )

    await knex.raw(createFunctionsSQL)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

export default { initDb }
