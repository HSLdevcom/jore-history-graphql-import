import { initDb } from "../src/initDb";

exports.up = async function(knex) {
  return initDb(knex);
};

exports.down = async function() {};
