import path from "path";
import { setFileError } from "../importStatus";

export async function catchFileError(filePath, duration = 0) {
  const fileName = path.basename(filePath);
  console.warn(`Downloaded file ${fileName} caused the task to fail.`);
  await setFileError(fileName, duration);
}
