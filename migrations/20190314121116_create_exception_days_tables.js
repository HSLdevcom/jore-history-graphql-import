const pick = require("lodash/pick");
const tables = require("../src/schema");
const { createTables, createForeignKeys } = require("../src/util/createDb");

exports.up = async function(knex) {
  const addTables = pick(tables, [
    "exception_days_calendar",
    "exception_days",
    "replacement_days_calendar",
  ]);

  await createTables("jore", knex, addTables);
  await createForeignKeys("jore", knex, addTables);
};

exports.down = async function() {
  return Promise.resolve();
};
