// stream that provides the data.
// Downloads the export from the default source and runs the import.
import { getSelectedTables } from "./selectedTables";
import { startImport, importCompleted } from "./importStatus";
import PQueue from "p-queue";
import { createImportStream } from "./database";
import { preprocess } from "./preprocess";
import { fetchExportFromFTP } from "./sources/fetchExportFromFTP";
import { DEFAULT_EXPORT_SOURCE } from "./constants";

const sources = {
  daily: fetchExportFromFTP,
};

async function importFile(fileStream, fileName) {
  const execStart = process.hrtime();
  const { selectedTables, selectedFiles } = getSelectedTables();

  try {
    await new Promise(async (resolve, reject) => {
      await startImport(fileName);

      const queue = new PQueue({ concurrency: 20 });
      const importerStream = await createImportStream(selectedTables, queue);

      console.log("Unpacking and processing the archive...");

      preprocess(fileStream, selectedFiles)
        .pipe(importerStream)
        .on("finish", () => {
          setTimeout(() => {
            resolve(queue.onEmpty());
          }, 1000);
        })
        .on("error", reject);
    });

    const [execDuration] = process.hrtime(execStart);
    await importCompleted(fileName, true, execDuration);

    console.log(
      `${selectedTables.join(", ")} from ${fileName} imported in ${execDuration}s`,
    );
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);

    console.log(`${fileName} import failed. Duration: ${execDuration}s`);
    console.error(err);

    await importCompleted(fileName, false, execDuration);
  }
}

// Downloads an export archive from the `source` function and runs the import.
// source should return a promise that resolves to `{name, file}`. `name` is the
// name of the downloaded archive we're about to import and `file` is a readable stream.

// onBefore and onAfter control the global "isImporting" state, while the onComplete
// callback is for the task scheduler.
export const createTaskForDefaultSource = (
  onBefore = () => {},
  onAfter = () => {},
) => async (onComplete = () => {}) => {
  const importId = "default-source";
  const downloadSource = sources[DEFAULT_EXPORT_SOURCE];

  if (!downloadSource) {
    console.log(`${DEFAULT_EXPORT_SOURCE} is not defined as a source for the importer.`);
    onComplete();
    return;
  }

  if (onBefore(importId)) {
    try {
      console.log(`Importing from source ${DEFAULT_EXPORT_SOURCE}.`);
      await importFromRemoteRepository(downloadSource);
    } catch (err) {
      console.log(err);
    }

    onAfter(importId);
  }

  onComplete();
};

export async function importFromUploadedFile(
  file,
  name,
  onBefore = () => {},
  onAfter = () => {},
) {
  const importId = "uploaded-file";

  if (!file) {
    console.log("Nothing to import.");
    return false;
  }

  if (onBefore(importId)) {
    try {
      await importFile(file, name);
    } catch (err) {
      console.error(err);
    }

    onAfter(importId);
  }

  return true;
}

async function importFromRemoteRepository(source) {
  console.log("Downloading import data...");
  const fileToImport = await source();

  if (!fileToImport) {
    console.log("Nothing to import.");
    return Promise.resolve(false);
  }

  const { name, file } = fileToImport;
  return importFile(file, name);
}
