import { preprocess } from "./preprocess";
import { runImport } from "./importPostgis";
import { getLatestExportFile } from "./util/joreExportManager";
import { initDb } from "./initDb";
import { getKnex } from "./knex";

const { knex } = getKnex();

(async () => {
  console.log("Initializing DB...");
  await initDb();
  await knex.migrate.latest();

  console.log("Checking latest import state...");
  await getLatestExportFile();
  /*await preprocess();
  await runImport();*/

  console.log("Ok, all done.");
  process.exit(0);
})();
