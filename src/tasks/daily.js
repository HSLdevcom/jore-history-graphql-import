import { DEFAULT_EXPORT_SOURCE } from "../constants";
import { catchFileError } from "../util/catchFileError";
import { importFile } from "../import";

export async function dailyTask(source) {
  let fileToImport = "";

  try {
    console.log(`Importing from source ${DEFAULT_EXPORT_SOURCE}.`);
    fileToImport = await source();
  } catch (err) {
    if (fileToImport) {
      await catchFileError(fileToImport);
    }

    return false
  }

  if (fileToImport) {
    return importFile(fileToImport);
  }

  return false
}
