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
import Queue from "p-queue";
import { createDbDump } from "./util/createDbDump";
import { uploadDbDump } from "./util/uploadDbDump";

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

  try {
    await startImport(fileName);
    const queue = new Queue({ concurrency: 20 });

    console.log("Unpacking and processing the archive...");
    const directory = await Open.file(filePath);
    const chosenFiles = directory.files.filter((file) =>
      selectedFiles.includes(file.path),
    );

    const filePromises = chosenFiles.map(
      (file) =>
        new Promise(async (resolve, reject) => {
          const tableName = getTableNameFromFileName(file.path);
          const importStream = await createImportStreamForTable(tableName, queue);

          file
            .stream()
            .pipe(iconv.decodeStream("ISO-8859-1"))
            .pipe(iconv.encodeStream("utf8"))
            .pipe(split())
            .pipe(processLine(tableName))
            .pipe(importStream)
            .on("finish", () => {
              resolve(tableName);
            })
            .on("error", reject);
        }),
    );

    console.log("Importing the data...");
    await Promise.all(filePromises);

    console.log("Finishing up...");
    await delay(3000);
    await queue.onEmpty();
  
    const dumpFilePath = await createDbDump();
    await uploadDbDump(dumpFilePath);

    const [execDuration] = process.hrtime(execStart);
    await importCompleted(fileName, true, execDuration);

    console.log(`${fileName} imported in ${execDuration}s`);
  } catch (err) {
    const [execDuration] = process.hrtime(execStart);

    console.log(`${fileName} import failed. Duration: ${execDuration}s`);
    console.error(err);

    await importCompleted(fileName, false, execDuration);
  }
}
