const initDb = require("../src/setup/initDb");

exports.up = async function(knex) {
  return initDb(knex);
};

exports.down = async function() {};
