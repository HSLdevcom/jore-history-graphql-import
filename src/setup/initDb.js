const { createTables, createForeignKeys } = require("./createDb");
const fs = require("fs-extra");
const path = require("path");
const tables = require("../schema");
const { pick } = require("lodash");

async function initDb(knex) {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "createSchema.sql"),
      "utf8",
    );

    await knex.raw(createSchemaSQL);

    const createdTables = await createTables("jore", tables, knex);

    if (createdTables.length !== 0) {
      await createForeignKeys("jore", pick(tables, createdTables), knex);
    }

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);

    if (process.env.JORE_POSTGRES_DB.includes("citus")) {
      const createDistributedTablesSQL = await fs.readFile(
        path.join(__dirname, "createDistributedTables.sql"),
        "utf8",
      );

      await knex.raw(createDistributedTablesSQL);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

module.exports = initDb;
