import { getImportData } from "./getImportData";
import { getKnex } from "./knex";
import schema from "./schema";
import { pick, compact, intersection, get } from "lodash";
import { preprocess } from "./preprocess";
import { getImportOrder, importSerially, importInParallel } from "./importData";
import fs from "fs-extra";
import path from "path";
import { startImport, importCompleted } from "./importStatus";

const { knex } = getKnex();
const cwd = process.cwd();
const dataPath = path.join(cwd, "data");

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

const importGroups = getImportOrder(selectedTables) || { serial: [], parallel: [] };

const getTableNameFromFileName = (filename) => {
  if (filename === "reittimuoto.dat") {
    return "geometry";
  }

  return Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];
};

// Buffer all files that need to be imported serially here.
const serialIndex = {};
const parallelIndex = {};

const preprocessAndSave = async (filename, fileStream) => {
  const tableName = getTableNameFromFileName(filename);

  if (!tableName) {
    return;
  }

  const preprocessed = preprocess(fileStream);
  const filePath = path.join(dataPath, filename);

  await new Promise((resolve, reject) => {
    preprocessed
      .pipe(fs.createWriteStream(filePath))
      .on("finish", () => resolve(true))
      .on("error", reject);
  });

  const index =
    serialIndex && importGroups.serial.includes(tableName) ? serialIndex : parallelIndex;

  index[tableName] = fs.createReadStream(filePath, { encoding: "utf8" });
};

(async () => {
  try {
    console.log("Initializing DB...");
    await knex.migrate.latest();

    const importPromise = new Promise(async (resolve, reject) => {
      console.log("Downloading and unpacking import data...");
      let exportName = null;

      try {
        await fs.emptyDir(dataPath);
        const bufferPromises = [];

        exportName = await getImportData(selectedFiles, (name, file) => {
          const bufferPromise = preprocessAndSave(name, file);
          bufferPromises.push(bufferPromise);
          return file;
        });

        if (bufferPromises.length !== 0) {
          console.log("Buffering files...");
          await Promise.all(bufferPromises);
        }
      } catch (err) {
        reject(err);
        return;
      }

      if (!exportName) {
        console.log("Nothing to import.");
        resolve();
        return;
      }

      await startImport(exportName);

      try {
        console.log("Importing rows into database...");
        await importSerially(serialIndex);
        await importInParallel(parallelIndex);
        await fs.emptyDir(dataPath);

        resolve(importCompleted(exportName, true));
      } catch (err) {
        await importCompleted(exportName, false);
        reject(err);
      }
    });

    await importPromise;

    console.log("Ok, all done.");
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
})();
