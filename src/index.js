import { getImportData } from "./getImportData";
import { getKnex } from "./knex";
import schema from "./schema";
import { pick, compact, intersection } from "lodash";
import { preprocess } from "./preprocess";
import { getImportOrder, importSerially, importInParallel } from "./importData";
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

const preprocessAndAssignToImportGroup = async (filename, fileStream) => {
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

const assignExistingFileToImportGroup = async (filename) => {
  const tableName = getTableNameFromFileName(filename);

  if (!tableName) {
    return;
  }

  const filePath = path.join(dataPath, filename);

  const index =
    serialIndex && importGroups.serial.includes(tableName) ? serialIndex : parallelIndex;

  index[tableName] = fs.createReadStream(filePath, { encoding: "utf8" });
};

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  const importPromise = new Promise(async (resolve, reject) => {
    try {
      console.log("Downloading and unpacking import data...");

      await fs.ensureDir(dataPath);
      const dataFiles = await fs.readdir(dataPath);

      const bufferPromises = [];

      if (intersection(selectedFiles, dataFiles).length !== selectedFiles.length) {
        await fs.emptyDir(dataPath);
        const dataStream = await getImportData(selectedFiles, (name, file) => {
          const bufferPromise = preprocessAndAssignToImportGroup(name, file);
          bufferPromises.push(bufferPromise);
        });

        if (!dataStream) {
          console.log("Nothing to import.");
          resolve();
        }
      } else {
        console.log("Data files found. Using existing data files for import.");
        intersection(selectedFiles, dataFiles).forEach((filename) => {
          const bufferPromise = assignExistingFileToImportGroup(filename);
          bufferPromises.push(bufferPromise);
        });
      }

      console.log("Buffering files...");
      await Promise.all(bufferPromises);

      console.log("Importing rows into database...");
      await importSerially(serialIndex);
      await importInParallel(parallelIndex);

      resolve(fs.emptyDir(dataPath));
    } catch (err) {
      reject(err);
    }
  });

  await importPromise;

  console.log("Ok, all done.");
  process.exit(0);
})();
