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

const { knex } = getKnex();
const { SERVER_PORT = 3000 } = process.env;

const cwd = process.cwd();
const uploadPath = path.join(cwd, "uploads");

// The global state that informs the app if an import task is running.
// Always check this state before starting an import.
let isImporting = false;

// Marks the global isImporting state as true, blocking other imports.
// Also acts as a guard that can be used in if-statements.
const onBeforeImport = () => {
  if (isImporting) {
    return false;
  }

  isImporting = true;
  return true;
};

// Sets the global isImporting state to false, allowing other import tasks to proceed.
const onAfterImport = () => {
  isImporting = false;
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

  app.use(express.urlencoded());

  app.use(
    basicAuth({
      users: { admin: "supersecret" },
    }),
  );

  app.engine("jsx", createEngine());
  app.set("view engine", "jsx");

  app.set("views", path.join(__dirname, "views"));

  app.get("/admin", (req, res) => {
    res.render("admin", { isImporting, selectedTables: getSelectedTableStatus() });
  });

  app.post("/run-daily", (req, res) => {
    runScheduledImportNow("daily");
    res.redirect("/admin");
  });

  app.post("/upload", async (req, res) => {
    if (Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    const exportFile = req.files.export;
    const exportName = exportFile.name;
    const exportPath = path.join(uploadPath, exportName);

    await fs.emptyDir(uploadPath);

    // Use the mv() method to place the file somewhere on your server
    exportFile.mv(exportPath, (err) => {
      if (err) {
        return res.status(500).send(err);
      }

      importFromUploadedFile(exportFile, exportName, onBeforeImport, onAfterImport).then(
        (imported) => {
          if (imported) {
            console.log("Upload completed!");
          } else {
            console.log("Import failed.");
          }
        },
      );

      res.redirect("/admin");
    });
  });

  app.post("/select-tables", (req, res) => {
    const tableSettings = req.body;

    for (const [tableName, isEnabled] of Object.entries(tableSettings)) {
      setTableOption(tableName, isEnabled);
    }

    res.redirect("/admin");
  });

  app.listen(SERVER_PORT, () => {
    console.log(`Server is listening on port ${SERVER_PORT}`);
  });
})();
