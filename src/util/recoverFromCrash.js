import { getLatestImportedFile, importCompleted } from "../importStatus";
import { runFtpImport } from "../importRunners";
import { DEBUG } from "../constants";

/**
 * If the process crashes, we need to mark the import that was in progress
 * as completed but failed. Otherwise it won't get retried.
 */

export async function recoverFromCrash() {
  const latestImport = await getLatestImportedFile();

  // Mark it as completed but failed, then retry.
  if (!DEBUG && latestImport && !latestImport.import_end && !latestImport.file_error) {
    await importCompleted(latestImport.filename, false);
    // Retry the import
    await runFtpImport();
  }
}
