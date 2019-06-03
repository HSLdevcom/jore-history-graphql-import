import { createTables, createForeignKeys } from "./util/createDb";
import fs from "fs-extra";
import path from "path";
import tables from "./schema";
import { pick } from "lodash";

export async function initDb(knex) {
  try {
    const createSchemaSQL = await fs.readFile(
      path.join(__dirname, "../src/", "createSchema.sql"),
      "utf8",
    );

    await knex.raw(createSchemaSQL);
    const createdTables = await createTables("jore", tables);

    if (createdTables.length !== 0) {
      await createForeignKeys("jore", pick(tables, createdTables));
    }

    const createFunctionsSQL = await fs.readFile(
      path.join(__dirname, "../src/", "createFunctions.sql"),
      "utf8",
    );

    await knex.raw(createFunctionsSQL);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
