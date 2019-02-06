const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const tables = require("../src/schema");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
  pool: {
    min: 0,
    max: 50,
  },
});

function createTables(knexSchema) {
  let schema = knexSchema;

  Object.entries(tables).forEach(([tableName, { fields }]) => {
    schema = schema.createTable(tableName, (table) => {
      fields.forEach(
        ({
          length,
          name,
          type,
          unique,
          primary,
          index,
          typeOptions,
          notNullable,
          defaultTo,
        }) => {
          if (name && type) {
            let column; // eslint-disable-line no-unused-vars
            if (type === "string") {
              column = table.string(name, length);
            } else if (type === "decimal") {
              column = table.decimal(name, 9, 6);
            } else {
              column = table[type](name, typeOptions);
            }
            if (primary) {
              if (Array.isArray(primary)) {
                column = column.primary(primary);
              } else {
                column = column.primary();
              }
            }
            if (unique) {
              column = column.unique();
            }
            if (index) {
              column = column.index();
            }
            if (notNullable) {
              column = column.notNullable();
            }
            if (defaultTo) {
              column = column.defaultTo(defaultTo);
            }
          }
        },
      );
      if (
        (_.find(fields, { name: "lat" }) && _.find(fields, { name: "lon" })) ||
        (_.find(fields, { name: "x" }) && _.find(fields, { name: "y" }))
      ) {
        table.specificType("point", "geometry(point, 4326)");
        table.index("point", `${tableName}_points_gix`, "GIST");
      }
    });
  });

  return schema;
}

function createForeignKeys(knexSchema) {
  let schema = knexSchema;

  Object.entries(tables).forEach(([tableName, { fields, primary }]) => {
    schema = schema.table(tableName, (table) => {
      if (primary) {
        table.unique(primary).primary(primary);
      }
      fields.forEach(({ name, type, foreign }) => {
        if (name && type && foreign) {
          table
            .foreign(name)
            .references(foreign.split(".")[1])
            .inTable(`jore.${foreign.split(".")[0]}`);
        }
      });
    });
  });

  return schema;
}

(async function initDb() {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "../src/", "createSchema.sql"),
      "utf8",
    );

    await knex.raw(createSchemaSQL);

    await createTables(knex.schema.withSchema("jore"));
    await createForeignKeys(knex.schema.withSchema("jore"));

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, "../src/", "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  process.exit(0);
})();
