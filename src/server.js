/* eslint-disable consistent-return */
import express from "express";
import fileUpload from "express-fileupload";
import basicAuth from "express-basic-auth";
import { ADMIN_PASSWORD, PATH_PREFIX, SERVER_PORT } from "./constants";
import { createEngine } from "express-react-views";
import path from "path";
import { getLatestImportedFile } from "./importStatus";
import { getSelectedTableStatus, setTableOption, toggleRemoveEnabled, toggleImportEnabled, getRemoveEnabledStatus, getImportEnabledStatus } from "./selectedTables";
import { createDbDump } from "./util/createDbDump";
import { uploadDbDump } from "./util/uploadDbDump";
import { reportError, reportInfo } from "./monitor";
import { handleUploadedFile } from "./util/handleUploadedFile";
import { runFileImport, runFtpImport } from "./importRunners";

export const server = (isImporting) => {
  const app = express();

  let manualDumpInProgress = false;

  app.use(
    fileUpload({
      useTempFiles: true,
      safeFileNames: true,
      preserveExtension: true,
    }),
  );

  app.use(express.urlencoded({ extended: true }));

  app.get("/check", (req, res) => {
    res.status(200).send("ok");
  });

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
      manualDumpInProgress,
      isImporting: isImporting(),
      latestImportedFile,
      selectedTables: getSelectedTableStatus(),
      removeEnabled: getRemoveEnabledStatus(),
      importEnabled: getImportEnabledStatus(),
    });
  });

  app.post("/run-daily", (req, res) => {
    console.log("Manually triggered FTP import task.");

    runFtpImport().then(() => {
      console.log("Manually triggered task completed.");
    });

    res.redirect(PATH_PREFIX);
  });

  app.post("/upload", async (req, res) => {
    if (Object.keys(req.files).length === 0) {
      return res.status(400).send("No files were uploaded.");
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let exportFilePath = "";

    try {
      exportFilePath = await handleUploadedFile(req.files.export);
    } catch (err) {
      res.status(500).send(err);
    }

    if (exportFilePath) {
      runFileImport(exportFilePath).then(() => {
        console.log("File import completed.");
      });
    }

    res.redirect(PATH_PREFIX);
  });

  app.post("/select-tables", (req, res) => {
    const tableSettings = req.body;

    const {
      remove_enabled = false,
      import_enabled = false,
      ...enabledTables
    } = tableSettings;

    let enabledTableNames = Object.keys(enabledTables);

    const allTables = Object.keys(getSelectedTableStatus());

    for (const tableName of allTables) {
      const isEnabled = enabledTableNames.includes(tableName);
      setTableOption(tableName, isEnabled);
    }

    toggleRemoveEnabled(!!remove_enabled);
    toggleImportEnabled(!!import_enabled);

    res.redirect(PATH_PREFIX);
  });

  app.post("/dump-upload", (req, res) => {
    if (!manualDumpInProgress) {
      manualDumpInProgress = true;

      createDbDump()
        .then(uploadDbDump)
        .then(() => {
          manualDumpInProgress = false;
        })
        .catch(reportError);
    }

    res.redirect(PATH_PREFIX);
  });

  app.listen(SERVER_PORT, () => {
    console.log(`Server is listening on port ${SERVER_PORT}`);
    reportInfo("Server started.")
  });
};
