import { Client } from "basic-ftp/dist/index";
import fs from "fs-extra";
import { orderBy, get } from "lodash";
import { getKnex } from "./knex";
import path from "path";
import { Parse } from "unzipper";
import es from "event-stream";
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

export async function getImportData(filesToDownload = []) {
  if (!FTP_PASSWORD || !FTP_USERNAME || !FTP_HOST || filesToDownload.length === 0) {
    return null;
  }

  const client = new Client();

  try {
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
    const latestImported = await getLatestImportedFile();

    if (
      // If the latest imported file is not the latest on the remote server...
      latestImported.filename !== newestFileName ||
      // Or if the latest import is not in progress and failed
      (!latestImported.success && latestImported.import_end !== null)
    ) {
      await fs.ensureDir(path.join(cwd, "downloads"));
      await fs.emptyDir(path.join(cwd, "data"));

      const downloadPath = path.join(cwd, "downloads", newestFileName);
      const fileExists = await fs.pathExists(downloadPath);

      if (!fileExists) {
        const downloadStream = fs.createWriteStream(downloadPath);
        await client.download(downloadStream, newestFileName);
      }

      const unzippedFiles = {};

      await fs
        .createReadStream(downloadPath)
        .pipe(Parse())
        .on("entry", async (entry) => {
          if (filesToDownload.includes(entry.path)) {
            const dataPath = path.join(cwd, "data", entry.path);
            const output = fs.createWriteStream(dataPath);
            return preprocess(entry, output);
          }

          return entry.autodrain();
        })
        .promise();

      return unzippedFiles;
    }
  } catch (err) {
    console.log(err);
  }

  return null;
}
