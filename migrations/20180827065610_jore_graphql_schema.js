const initDb = require("../src/setup/initDb");
const fs = require("fs-extra");
const path = require("path");

exports.up = async function(knex) {
  return initDb(knex);
};

exports.down = async function(knex) {
  // This drops the schema and all data!!! Do not roll back unless this is your intention.
  const dropSchemaSQL = await fs.readFile(
    path.join(__dirname, "../src/setup", "dropSchema.sql"),
    "utf8",
  );

  return knex.raw(dropSchemaSQL);
};
