import { fetchExportFromFTP } from "./sources/fetchExportFromFTP";
import { getKnex } from "./knex";
import { processArchive } from "./processArchive";
import { startImport, importCompleted } from "./importStatus";
import { createImportStream } from "./importData";
import PQueue from "p-queue";
import { getSelectedTables } from "./util/getSelectedTables";
import {
  createScheduledImport,
  EARLY_MORNING,
  startScheduledImport,
} from "./scheduledImports";

const { knex } = getKnex();
const { selectedTables, selectedFiles } = getSelectedTables();

const sources = {
  daily: fetchExportFromFTP,
};

createScheduledImport("daily", EARLY_MORNING, importFromDefaultSource);

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  // Start the task for the daily import as soon as the server starts.
  startScheduledImport("daily");
})();

async function importFile(fileStream, fileName) {
  try {
    await new Promise(async (resolve, reject) => {
      await startImport(fileName);

      const queue = new PQueue({ concurrency: 50 });
      const importerStream = await createImportStream(selectedTables, queue);

      console.log("Unpacking and processing the archive...");
      processArchive(fileStream, selectedFiles)
        .pipe(importerStream)
        .on("finish", () => {
          setTimeout(() => {
            resolve(queue.onEmpty());
          }, 1000);
        })
        .on("error", reject);
    });

    console.log("Ok, all done.");
  } catch (err) {
    console.error(err);
    await importCompleted(fileName, false);
  }
}

// Downloads the export from the default source and runs the import.
async function importFromDefaultSource(onComplete = () => {}) {
  const { DEFAULT_EXPORT_SOURCE = "daily" } = process.env;
  const downloadSource = sources[DEFAULT_EXPORT_SOURCE];

  if (downloadSource) {
    console.log(`Importing from source ${DEFAULT_EXPORT_SOURCE}.`);
    await importFromRemoteRepository(downloadSource);
  } else {
    console.log(`${DEFAULT_EXPORT_SOURCE} is not defined as a source for the importer.`);
  }

  onComplete();
}

// Downloads an export archive from the `source` function and runs the import.
// source should return a promise that resolves to `{name, file}`. `name` is the
// name of the downloaded archive we're about to import and `file` is a readable
// stream that provides the data.
async function importFromRemoteRepository(source) {
  try {
    console.log("Downloading import data...");
    const fileToImport = await source();

    if (!fileToImport) {
      console.log("Nothing to import.");
      return Promise.resolve(false);
    }

    const { name, file } = fileToImport;
    return importFile(file, name);
  } catch (err) {
    console.error(err);
  }

  return Promise.resolve(false);
}
