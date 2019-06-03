import Client from "ftp-ts";
import fs from "fs-extra";
import { orderBy, get } from "lodash";
import { getKnex } from "./knex";
import path from "path";
import { Parse } from "unzipper";
import { preprocess } from "./preprocess";

const { knex } = getKnex();
const cwd = process.cwd();

const {
  FTP_USERNAME = "",
  FTP_PASSWORD = "",
  FTP_HOST = "",
  FTP_PORT = "21",
  FTP_EXPORTS_DIR_PATH = "/",
} = process.env;

async function getLatestImportedFile() {
  return knex
    .withSchema("jore")
    .first()
    .from("import_status")
    .orderBy("import_start", "desc")
    .limit(1);
}

async function getFromFTP() {
  if (!FTP_PASSWORD || !FTP_USERNAME || !FTP_HOST) {
    return null;
  }

  const client = await Client.connect({
    host: FTP_HOST,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
    port: FTP_PORT,
    secure: false,
  });

  await client.cwd(FTP_EXPORTS_DIR_PATH);
  const files = await client.list();

  const zips = files.filter(({ name }) => name.endsWith(".zip"));
  const newestFile = orderBy(zips, "name", "desc")[0];
  const newestFileName = get(newestFile, "name", "");

  return {
    newestExportName: newestFileName,
    getFileStream: () => client.get(newestFileName),
    closeClient: () => client.end(),
  };
}

export async function getImportData(filesToDownload = [], onFileDownloaded) {
  try {
    const latestImported = await getLatestImportedFile();
    const ftp = await getFromFTP();

    if (!ftp) {
      return null;
    }

    const { newestExportName, getFileStream, closeClient } = ftp;

    if (!newestExportName) {
      return null;
    }

    if (
      newestExportName !== latestImported ||
      // If the latest import is not in progress and failed
      (!latestImported.success && latestImported.import_end !== null)
    ) {
      console.log(`Newest export is ${newestExportName}`);
      const fileStream = await getFileStream();

      await fileStream
        .pipe(Parse())
        .on("entry", (entry) => {
          if (filesToDownload.includes(entry.path)) {
            onFileDownloaded(entry.path, entry);
          }

          entry.autodrain();
        })
        .promise();

      console.log("Export downloaded.");

      closeClient();
      return true;
    }

    closeClient();
  } catch (err) {
    console.log(err);
  }

  return null;
}
