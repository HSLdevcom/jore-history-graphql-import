// stream that provides the data.
// Downloads the export from the default source and runs the import.
import {
  getSelectedTables,
  getImportEnabledStatus,
  getRemoveEnabledStatus,
} from "./selectedTables";
import { startImport, importCompleted } from "./importStatus";
import { createImportStreamForTable, vacuumAnalyze } from "./database";
import { processLine } from "./preprocess";
import path from "path";
import { Open } from "unzipper";
import schema from "./schema";
import iconv from "iconv-lite";
import split from "split2";
import { catchFileError } from "./util/catchFileError";
import { reportError, reportInfo } from "./monitor";
import { createDbDump } from "./util/createDbDump";
import { uploadDbDump } from "./util/uploadDbDump";
import { ENVIRONMENT, QUEUE_SIZE } from "./constants";
import { createQueue } from "./util/createQueue";
import { cleanupRowsFromFile } from "./cleanRemovedRows";

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];

async function doFileImport(file) {
  const { queueAdd, onQueueEmpty } = createQueue(QUEUE_SIZE);

  await new Promise((resolve, reject) => {
    const tableName = getTableNameFromFileName(file.path);

    createImportStreamForTable(tableName, queueAdd).then((importStream) => {
      const readStream = file
        .stream()
        .pipe(iconv.decodeStream("ISO-8859-1"))
        .pipe(iconv.encodeStream("utf8"))
        .pipe(split())
        .pipe(processLine(tableName));

      readStream.on("error", (err) => {
        importStream.destroy(err);
        reject(err);
      });

      readStream.pipe(importStream);

      importStream
        .on("finish", () => {
          console.log(`Reading file for table ${tableName} finished.`);
          resolve(tableName);
        })
        .on("error", (err) => {
          readStream.destroy(err);
          reject(err);
        });
    });
  });

  await onQueueEmpty();
}

// Imports the file ar the path. Removes rows listed in the *_removed.dat files.
// Return true to signal a successful run that should NOT be retried, return false
// to signal a failed run that should be retried. Return true even if "failed"
// if retries are not possible for the current condition.
export async function importFile(filePath) {
  const execStart = process.hrtime();
  const { selectedFiles } = getSelectedTables();
  const fileName = path.basename(filePath);

  let importEnabled = getImportEnabledStatus();
  let removeEnabled = getRemoveEnabledStatus();

  if (!importEnabled && !removeEnabled) {
    // This is a user error, but the run is technically successful in that it
    // should't be retried. User action is needed to enable either or both modes.
    let message = "Neither import nor remove modes are enabled. Doing nothing.";
    await reportInfo(message);
    console.log(message);
    return true; // true = success
  }

  await startImport(fileName);

  let selectedRemoveFiles = selectedFiles.map(
    (f) => `${f.replace(".dat", "")}_removed.dat`,
  );

  let chosenFiles = [];
  let chosenRemoveFiles = [];

  try {
    console.log("Unpacking and processing the archive...");
    const directory = await Open.file(filePath);

    chosenFiles = directory.files.filter((file) => selectedFiles.includes(file.path));
    chosenRemoveFiles = directory.files.filter((file) =>
      selectedRemoveFiles.includes(file.path),
    );
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);
    await catchFileError(filePath, execDuration);
    return false;
  }

  try {
    // Remove goes first, otherwise there may be rows in the db that shouldn't
    // be there and match the primary key of incoming items.
    if (removeEnabled) {
      console.log("Removing deleted rows...");

      for (const file of chosenRemoveFiles) {
        await cleanupRowsFromFile(file);
      }
    }

    // Run the import part of the operation
    if (importEnabled) {
      console.log("Importing the data...");

      for (const file of chosenFiles) {
        await doFileImport(file);
      }
    }

    console.log("Finishing up...");
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);

    const message = `${fileName} import failed. Duration: ${execDuration}s`;
    await reportError(message);

    console.log(message);
    console.error(err);

    await importCompleted(fileName, false, execDuration);
    return false;
  }

  /*if (ENVIRONMENT !== "local") {
    try {
      await vacuumAnalyze();
    } catch (err) {
      await reportError(err.message || "Vacuum analyze failed.");
      console.log(err.message || "Vacuum analyze failed.");
      console.error(err);
    }

    try {
      const dumpFilePath = await createDbDump();
      await uploadDbDump(dumpFilePath);
    } catch (err) {
      await reportError(err.message || "DB upload failed.");
      console.log(err.message || "DB upload failed.");
      console.error(err);
    }
  }*/

  const [execDuration] = process.hrtime(execStart);
  await importCompleted(fileName, true, execDuration);

  const message = `${fileName} imported in ${execDuration}s`;
  await reportInfo(message);
  console.log(message);

  return true;
}
