/* eslint-disable consistent-return */
import { fetchExportFromFTP } from "./sources/fetchExportFromFTP";
import { getKnex } from "./knex";
import { getSelectedTableStatus, setTableOption } from "./selectedTables";
import {
  createScheduledImport,
  EARLY_MORNING,
  startScheduledImport,
  runScheduledImportNow,
} from "./schedule";
import express from "express";
import fileUpload from "express-fileupload";
import { createEngine } from "express-react-views";
import path from "path";
import fs from "fs-extra";
import basicAuth from "express-basic-auth";
import { importFromUploadedFile, createTaskForDefaultSource } from "./import";
import { getLatestImportedFile } from "./importStatus";
import { SERVER_PORT, ADMIN_PASSWORD, PATH_PREFIX } from "./constants";

const { knex } = getKnex();

const cwd = process.cwd();
const uploadPath = path.join(cwd, "uploads");

// The global state that informs the app if an import task is running.
// Always check this state before starting an import.
let isImporting = false;
let currentImporter = "";

// Marks the global isImporting state as true, blocking other imports.
// Also acts as a guard that can be used in if-statements.
const onBeforeImport = (importerId = "global") => {
  if (isImporting) {
    return false;
  }

  isImporting = true;
  currentImporter = importerId;

  return true;
};

// Sets the global isImporting state to false, allowing other import tasks to proceed.
const onAfterImport = (importerId = "global") => {
  if (importerId === currentImporter) {
    isImporting = false;
    currentImporter = "";
    return true;
  }

  return false;
};

createScheduledImport(
  "daily",
  EARLY_MORNING,
  createTaskForDefaultSource(onBeforeImport, onAfterImport),
);

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  // Start the task for the daily import as soon as the server starts.
  // This will start the timer and run the task once.
  startScheduledImport("daily");

  const app = express();

  app.use(
    fileUpload({
      useTempFiles: true,
      safeFileNames: true,
      preserveExtension: true,
    }),
  );

  app.use(express.urlencoded({ extended: true }));

  app.use(
    basicAuth({
      challenge: true,
      users: { admin: ADMIN_PASSWORD },
    }),
  );

  app.engine("jsx", createEngine());
  app.set("view engine", "jsx");
  app.set("views", path.join(__dirname, "views"));

  app.get("/", async (req, res) => {
    const latestImportedFile = await getLatestImportedFile();

    res.render("admin", {
      isImporting,
      latestImportedFile,
      selectedTables: getSelectedTableStatus(),
    });
  });

  app.post("/run-daily", (req, res) => {
    runScheduledImportNow("daily");
    res.redirect(PATH_PREFIX);
  });

  app.post("/upload", async (req, res) => {
    if (Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    const exportFile = req.files.export;
    const exportName = `${exportFile.name.replace(".zip", "")}-downloaded.zip`;
    const exportPath = path.join(uploadPath, exportName);

    await fs.emptyDir(uploadPath);

    // Use the mv() method to place the file somewhere on your server
    exportFile.mv(exportPath, (err) => {
      if (err) {
        return res.status(500).send(err);
      }

      const fileStream = fs.createReadStream(exportPath);
      importFromUploadedFile(fileStream, exportName, onBeforeImport, onAfterImport).then(
        (imported) => {
          if (imported) {
            console.log("Upload completed!");
          } else {
            console.log("Import failed.");
          }
        },
      );

      res.redirect(PATH_PREFIX);
    });
  });

  app.post("/select-tables", (req, res) => {
    const tableSettings = req.body;

    const enabledTables = Object.keys(tableSettings);
    const allTables = Object.keys(getSelectedTableStatus());

    for (const tableName of allTables) {
      const isEnabled = enabledTables.includes(tableName);
      setTableOption(tableName, isEnabled);
    }

    res.redirect(PATH_PREFIX);
  });

  app.listen(SERVER_PORT, () => {
    console.log(`Server is listening on port ${SERVER_PORT}`);
  });
})();
