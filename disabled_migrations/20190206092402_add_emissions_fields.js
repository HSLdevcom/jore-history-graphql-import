exports.up = async function (knex) {
  const hasEmissionClass = await knex.schema
    .withSchema('jore')
    .hasColumn('equipment', 'emission_class')

  const hasEmissionDescription = await knex.schema
    .withSchema('jore')
    .hasColumn('equipment', 'emission_desc')

  await knex.schema.withSchema('jore').table('equipment', (table) => {
    if (hasEmissionClass === false) {
      table.string('emission_class', 2)
    }
    if (hasEmissionDescription === false) {
      table.string('emission_desc', 30)
    }
  })
}

exports.down = async function (knex) {
  const hasEmissionClass = await knex.schema
    .withSchema('jore')
    .hasColumn('equipment', 'emission_class')

  const hasEmissionDescription = await knex.schema
    .withSchema('jore')
    .hasColumn('equipment', 'emission_desc')

  await knex.schema.withSchema('jore').table('equipment', (table) => {
    if (hasEmissionClass) {
      table.dropColumn('emission_class')
    }
    if (hasEmissionDescription) {
      table.dropColumn('emission_desc')
    }
  })
}
