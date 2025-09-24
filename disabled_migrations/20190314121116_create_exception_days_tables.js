const pick = require('lodash/pick')
const tables = require('../src/schema')
const { createTables, createForeignKeys } = require('../src/setup/createDb')

exports.up = async function (knex) {
  const hasTables = [
    knex.schema.withSchema('jore').hasTable('exception_days_calendar'),
    knex.schema.withSchema('jore').hasTable('exception_days'),
    knex.schema.withSchema('jore').hasTable('replacement_days_calendar'),
  ]

  const tableStatus = await Promise.all(hasTables)

  // Bail if any table already exists.
  if (tableStatus.some((exists) => exists)) {
    return
  }

  const addTables = pick(tables, [
    'exception_days_calendar',
    'exception_days',
    'replacement_days_calendar',
  ])

  await createTables('jore', knex, addTables)
  await createForeignKeys('jore', knex, addTables)
}

exports.down = async function () {
  return Promise.resolve()
}
