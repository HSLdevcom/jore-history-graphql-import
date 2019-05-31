import { preprocess } from "./preprocess";
import { runImport } from "./importPostgis";
import { getImportData } from "./getImportData";
import { initDb } from "./initDb";
import { getKnex } from "./knex";
import schema from "./schema";

const { knex } = getKnex();

(async () => {
  console.log("Initializing DB...");
  await initDb();
  await knex.migrate.latest();

  console.log("Getting import data...");

  const dataStream = await getImportData(
    Object.values(schema)
      .filter(({ filename }) => !["aikat.dat", "pysakki.dat"].includes(filename))
      .map(({ filename }) => filename),
  );

  if (!dataStream) {
    console.log("Nothing to import.");
    process.exit(0);
  }

  /*await preprocess();
  await runImport();*/

  console.log("Ok, all done.");
  process.exit(0);
})();
