import { importFile } from "../import";
import { reportError } from "../monitor";

export async function dailyTask(source) {
  let fileToImport = null;

  try {
    fileToImport = await source();
  } catch (err) {
    await reportError("Downloading the daily file failed.");
    return false;
  }

  if (fileToImport) {
    return importFile(fileToImport).catch(reportError);
  }

  // If there are no files to import (ie the newest import is already done)
  // return true to stop this task from being retried.
  return true;
}
