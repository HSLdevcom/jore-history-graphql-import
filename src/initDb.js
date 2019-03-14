import { createTables, createForeignKeys } from "./util/createDb";

const fs = require("fs-extra");
const path = require("path");
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

(async function initDb() {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "../src/", "createSchema.sql"),
      "utf8",
    );

    await knex.raw(createSchemaSQL);

    await createTables("jore", knex, tables);
    await createForeignKeys("jore", knex, tables);

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
