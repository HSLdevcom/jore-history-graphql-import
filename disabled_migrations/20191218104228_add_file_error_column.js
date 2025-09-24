exports.up = async function (knex) {
  return knex.schema.alterTable('public.import_status', (table) => {
    table.boolean('file_error').defaultTo(false)
  })
}

exports.down = async function () {
  return Promise.resolve()
}
