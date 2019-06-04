import { Client } from "basic-ftp";
import { orderBy, get } from "lodash";
import { getKnex } from "./knex";
import { Parse } from "unzipper";
import path from "path";
import fs from "fs-extra";

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

  const client = new Client();

  await client.access({
    host: FTP_HOST,
    user: FTP_USERNAME,
    password: FTP_PASSWORD,
    port: FTP_PORT,
    secure: false,
  });

  await client.cd(FTP_EXPORTS_DIR_PATH);
  const files = await client.list();

  const zips = files.filter(({ name }) => name.endsWith(".zip"));
  const newestFile = orderBy(zips, "name", "desc")[0];
  const newestFileName = get(newestFile, "name", "");

  return {
    newestExportName: newestFileName,
    download: (writeStream) => client.download(writeStream, newestFileName),
    closeClient: () => client.close(),
  };
}

export async function getImportData(filesToDownload = [], onFile) {
  try {
    const latestImported = await getLatestImportedFile();
    const ftp = await getFromFTP();

    if (!ftp) {
      return null;
    }

    const { newestExportName, download, closeClient } = ftp;

    if (!newestExportName) {
      return null;
    }

    if (
      newestExportName !== latestImported ||
      // If the latest import is not in progress and failed
      (!latestImported.success && latestImported.import_end !== null)
    ) {
      await fs.ensureDir(path.join(cwd, "downloads"));

      const downloadPath = path.join(cwd, "downloads", newestExportName);
      const fileExists = await fs.pathExists(downloadPath);

      if (!fileExists) {
        const writeStream = fs.createWriteStream(downloadPath);
        await download(writeStream);
        closeClient();
      }

      await fs
        .createReadStream(downloadPath)
        .pipe(Parse())
        .on("entry", (entry) => {
          if (filesToDownload.includes(entry.path)) {
            onFile(entry.path, entry);
          } else {
            entry.autodrain();
          }
        })
        .promise();

      console.log("Export downloaded.");
      return true;
    }

    closeClient();
  } catch (err) {
    console.log(err);
  }

  return null;
}
