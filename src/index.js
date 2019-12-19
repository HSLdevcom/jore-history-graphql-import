/* eslint-disable consistent-return */
import { getKnex } from "./knex";
import { createScheduledImport, startScheduledImport } from "./schedule";
import { DEFAULT_EXPORT_SOURCE, DAILY_TASK_SCHEDULE } from "./constants";
import { fetchExportFromFTP } from "./sources/fetchExportFromFTP";
import { server } from "./server";
import { dailyTask } from "./tasks/daily";
import { reportError } from "./monitor";

const { knex } = getKnex();

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

// This is the daily scheduled task that runs the import.
createScheduledImport("daily", DAILY_TASK_SCHEDULE, async (onComplete = () => {}) => {
  const importId = "default-source";
  console.log(`Importing from source ${DEFAULT_EXPORT_SOURCE}.`);

  let success = false;
  let tries = 0;

  if (onBeforeImport(importId)) {
    while (success === false && tries < 10) {
      success = await dailyTask(fetchExportFromFTP);
      tries++;
    }

    if (!success) {
      await reportError("The daily task exited after 10 unsuccessful attempts.");
      process.exit(1);
    }
  }

  onAfterImport(importId);
  onComplete();
});

(async () => {
  console.log("Initializing DB...");
  await knex.migrate.latest();

  // Start the task for the daily import as soon as the server starts.
  // This will start the timer and run the task once.
  startScheduledImport("daily");
  server(() => isImporting, onBeforeImport, onAfterImport);
})();
