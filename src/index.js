import { getImportData } from "./getImportData";
import { getKnex } from "./knex";
import schema from "./schema";
import { pick, compact } from "lodash";
import { processArchive } from "./processArchive";
import fs from "fs-extra";
import path from "path";
import { startImport, importCompleted } from "./importStatus";
import { importStream } from "./importData";

const { knex } = getKnex();
const cwd = process.cwd();

const [...selectedTableNames] = process.argv.slice(2);

const selectedTables =
  selectedTableNames.length === 0 ? Object.keys(schema) : selectedTableNames;

const selectedSchema =
  selectedTables.length !== 0
    ? Object.values(pick(schema, selectedTables))
    : Object.values(schema);

const selectedFiles = compact(selectedSchema.map(({ filename }) => filename)).filter(
  (filename) => filename !== "aikat.dat",
);

(async () => {
  let exportName = null;

  try {
    console.log("Initializing DB...");
    await knex.migrate.latest();

    console.log("Downloading import data...");
    exportName = await getImportData();

    if (!exportName) {
      console.log("Nothing to import.");
      process.exit(0);
      return;
    }

    // await startImport(exportName);

    const archivePath = path.join(cwd, "downloads", exportName);
    const archiveStream = fs.createReadStream(archivePath);

    console.log("Unpacking and processing import data...");
    const lineStream = processArchive(archiveStream, selectedFiles);

    // Importing data...
    await importStream(selectedTables, lineStream);
    // await importCompleted(exportName, true);

    console.log("Ok, all done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    // await importCompleted(exportName, false);
    process.exit(1);
  }
})();
