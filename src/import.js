// stream that provides the data.
// Downloads the export from the default source and runs the import.
import { getSelectedTables } from "./selectedTables";
import { startImport, importCompleted } from "./importStatus";
import { createImportStreamForTable } from "./database";
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
import { ENVIRONMENT } from "./constants";
import { cleanupRowsFromFile } from "./cleanRemovedRows";
import { createQueue } from "./util/createQueue";

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];

async function doFileImport(file) {
  const { queueAdd, onQueueEmpty } = createQueue();

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

export async function importFile(filePath) {
  const execStart = process.hrtime();
  const { selectedFiles } = getSelectedTables();
  const fileName = path.basename(filePath);

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
    console.log("Removing deleted rows...");

    for (const file of chosenRemoveFiles) {
      await cleanupRowsFromFile(file);
    }

    console.log("Importing the data...");

    for (const file of chosenFiles) {
      await doFileImport(file);
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

  if (ENVIRONMENT !== "local") {
    try {
      const dumpFilePath = await createDbDump();
      await uploadDbDump(dumpFilePath);
    } catch (err) {
      await reportError(err.message || "DB upload failed.");
      console.log(err.message || "DB upload failed.");
      console.error(err);
    }
  }

  const [execDuration] = process.hrtime(execStart);
  await importCompleted(fileName, true, execDuration);

  const message = `${fileName} imported in ${execDuration}s`;
  await reportInfo(message);
  console.log(message);

  return true;
}
