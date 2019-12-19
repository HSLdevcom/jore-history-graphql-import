import { importFile } from "../import";

export async function dailyTask(source) {
  let fileToImport = null;

  try {
    fileToImport = await source();
  } catch (err) {
    return false;
  }

  if (fileToImport) {
    return importFile(fileToImport);
  }

  // If there are no files to import (ie the newest import is already done)
  // return true to stop this task from being retried.
  return true;
}
