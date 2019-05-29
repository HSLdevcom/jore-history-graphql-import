import { createTables, createForeignKeys } from "./util/createDb";
import fs from "fs-extra";
import path from "path";
import tables from "./schema";
import { getKnex } from "./knex";

const { knex } = getKnex();

export async function initDb() {
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
}
