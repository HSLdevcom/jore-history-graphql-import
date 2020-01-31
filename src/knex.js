import Knex from "knex";
import KnexPostgis from "knex-postgis";
import { JORE_PG_CONNECTION } from "./constants";

let knex = null;
let st = null;

export function getKnex() {
  if (knex && st) {
    return { knex, st };
  }

  knex = Knex({
    dialect: "postgres",
    client: "pg",
    connection: JORE_PG_CONNECTION,
    pool: {
      min: 0,
      max: 40,
    },
  });

  // install postgis functions in knex.postgis;
  st = KnexPostgis(knex);

  return { knex, st };
}
