exports.up = async function(knex) {
  const schema = knex.schema.withSchema("jore");

  if ((await schema.hasColumn("stop", "stop_radius")) === false) {
    await schema.table("stop", (table) => {
      table.integer("stop_radius");
    });
  }

  if ((await schema.hasTable("equipment")) === false) {
    await schema.createTable("equipment", (table) => {
      table.string("class");
      table.string("registry_nr").notNullable();
      table.string("age");
      table.string("type");
      table.integer("multi_axle");
      table.string("exterior_color");

      table.index("registry_nr");
    });
  }
};

exports.down = async function(knex) {
  const schema = knex.schema.withSchema("jore");

  await schema.dropTableIfExists("equipment");

  if (await schema.hasColumn("stop", "stop_radius")) {
    await schema.table("stop", async (table) => {
      table.dropColumn("stop_radius");
    });
  }
};
