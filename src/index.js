import { getImportData } from "./getImportData";
import { getKnex } from "./knex";
import schema from "./schema";
import { pick, compact, intersection } from "lodash";
import { preprocess } from "./preprocess";
import { getImportOrder, importSerialFiles, importParallelFiles } from "./importFile";
import { bufferStream } from "./util/bufferStream";
import fs from "fs-extra";
import path from "path";

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
    parallelIndex[tableName] = bufferStream(preprocessed, false);
  }

  await fs.writeFile(path.join(dataPath, filename), preprocessed);
};

const assignExistingFileToImportGroup = async (filename, fileStream) => {
  const tableName = getTableNameFromFileName(filename);

  if (!tableName) {
    return;
  }

  if (serialIndex && importGroups.serial.includes(tableName)) {
    serialIndex[tableName] = await bufferStream(fileStream);
  }

  if (importGroups.parallel.includes(tableName)) {
    parallelIndex[tableName] = bufferStream(fileStream, false);
  }
};

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  const importPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Downloading and unpacking import data...");

      await fs.ensureDir(dataPath);
      const dataFiles = await fs.readdir(dataPath);

      console.log(dataFiles);
      process.exit(0);

      const bufferPromises = [];
      const allSelectedFiles = selectedFiles.filter((name) => name !== "aikat.dat");

      if (intersection(allSelectedFiles, dataFiles).length !== allSelectedFiles.length) {
        await fs.emptyDir(dataPath);
        const dataStream = await getImportData(allSelectedFiles, (name, file) => {
          const bufferPromise = assignToImportGroup(name, file);
          bufferPromises.push(bufferPromise);
        });

        if (!dataStream) {
          console.log("Nothing to import.");
          resolve();
        }
      } else {
        dataFiles.forEach((filename) => {
          const filepath = path.join(dataPath, filename);
          const readStream = fs.createReadStream(filepath);
          const bufferPromise = assignExistingFileToImportGroup(filename, readStream);
          bufferPromises.push(bufferPromise);
        });
      }

      console.log("Buffering data...");
      await Promise.all(bufferPromises);

      console.log("Importing rows into database...");
      await importSerialFiles(serialIndex);
      await importParallelFiles(parallelIndex);

      resolve(fs.emptyDir(dataPath));
    } catch (err) {
      reject(err);
    }
  });

  await importPromise;

  console.log("Ok, all done.");
  process.exit(0);
})();
