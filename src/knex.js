import Knex from "knex";
import KnexPostgis from "knex-postgis";

let knex = null;
let st = null;

export function getKnex() {
  if (knex && st) {
    return { knex, st };
  }

  knex = Knex({
    dialect: "postgres",
    client: "pg",
    connection: process.env.PG_CONNECTION_STRING,
    pool: {
      min: 0,
      max: 50,
    },
  });

  // install postgis functions in knex.postgis;
  st = KnexPostgis(knex);

  return { knex, st };
}
