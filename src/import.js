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
import pAll from "p-all";
import PQueue from "p-queue";
import { catchFileError } from "./util/catchFileError";
import { reportError, reportInfo } from "./monitor";
import { createDbDump } from "./util/createDbDump";
import { uploadDbDump } from "./util/uploadDbDump";
import { ENVIRONMENT } from "./constants";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];

export async function importFile(filePath) {
  const execStart = process.hrtime();
  const { selectedFiles } = getSelectedTables();
  const fileName = path.basename(filePath);

  await startImport(fileName);
  const queue = new PQueue({ concurrency: 25 });
  const queuedPromises = [];
  let queueTime = 0;

  const queueAdd = (promiseFn) => {
    const queuedPromise = queue.add(promiseFn);
    queuedPromises.push(queuedPromise);
    queueTime += 100;
  };

  let chosenFiles = [];

  try {
    console.log("Unpacking and processing the archive...");
    const directory = await Open.file(filePath);
    chosenFiles = directory.files.filter((file) => selectedFiles.includes(file.path));
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);
    await catchFileError(filePath, execDuration);
    return false;
  }

  try {
    const filePromises = chosenFiles.map(
      (file) =>
        new Promise((resolve, reject) => {
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
                console.log("finish");
                resolve(tableName);
              })
              .on("error", (err) => {
                readStream.destroy(err);
                reject(err);
              });
          });
        }),
    );

    console.log("Importing the data...");
    await Promise.all(filePromises);

    await queue.onEmpty();

    console.log(queueTime);
    await delay(queueTime);

    await Promise.all(queuedPromises);
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
