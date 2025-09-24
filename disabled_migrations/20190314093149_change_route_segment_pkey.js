const get = require('lodash/get')

exports.up = async function (knex) {
  const indexCheck = await knex.raw(`
    SELECT to_regclass('jore.route_segment_route_id_direction_date_begin_date_end_stop_id_un');
  `)

  const indexExists = get(indexCheck, 'rows[0].to_regclass', null) !== null

  if (indexExists) {
    await knex.schema.withSchema('jore').table('route_segment', (table) => {
      table.dropPrimary()
      table.dropUnique([], 'route_segment_route_id_direction_date_begin_date_end_stop_id_un')

      table.primary(['route_id', 'direction', 'date_begin', 'date_end', 'stop_index'])
    })
  }
}

exports.down = async function () {
  return Promise.resolve()
}
