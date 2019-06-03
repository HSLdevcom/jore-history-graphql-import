import { getImportData } from "./getImportData";
import { getKnex } from "./knex";
import schema from "./schema";
import { pick, compact } from "lodash";
import { preprocess } from "./preprocess";
import { getImportOrder, importSerialFiles, importParallelFiles } from "./importFile";
import { bufferStream } from "./util/bufferStream";

const { knex } = getKnex();

const [...selectedTableNames] = process.argv.slice(2);

const selectedTables =
  selectedTableNames.length === 0 ? Object.keys(schema) : selectedTableNames;

const selectedSchema =
  selectedTables.length !== 0
    ? Object.values(pick(schema, selectedTables))
    : Object.values(schema);

const selectedFiles = compact(selectedSchema.map(({ filename }) => filename));
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

const assignToImportGroup = async (filename, fileStream) => {
  const tableName = getTableNameFromFileName(filename);

  if (!tableName) {
    return;
  }

  const preprocessed = preprocess(fileStream);

  if (serialIndex && importGroups.serial.includes(tableName)) {
    serialIndex[tableName] = await bufferStream(preprocessed);
  }

  if (importGroups.parallel.includes(tableName)) {
    parallelIndex[tableName] = preprocessed;
  }
};

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  const importPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Downloading and unpacking import data...");

      const bufferPromises = [];
      const dataStream = await getImportData(
        selectedFiles.filter((name) => name !== "aikat.dat"),
        (name, file) => {
          const bufferPromise = assignToImportGroup(name, file);
          bufferPromises.push(bufferPromise);
          return bufferPromise;
        },
      );

      if (!dataStream) {
        console.log("Nothing to import.");
        resolve();
      }

      console.log("Buffering serial data...");
      await Promise.all(bufferPromises);

      console.log("Importing rows into database...");
      await importSerialFiles(serialIndex);
      resolve(importParallelFiles(parallelIndex));
    } catch (err) {
      reject(err);
    }
  });

  await importPromise;

  console.log("Ok, all done.");
  process.exit(0);
})();
