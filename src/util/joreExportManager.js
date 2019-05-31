import { Client } from "basic-ftp";
import fs from "fs-extra";
import { orderBy, get } from "lodash";
import { getKnex } from "../knex";

const { knex } = getKnex();

const {
  FTP_USERNAME = "",
  FTP_PASSWORD = "",
  FTP_HOST = "",
  FTP_PORT = "21",
  FTP_EXPORTS_DIR_PATH = "/",
} = process.env;

async function getLatestImportedFile() {
  const result = await knex
    .withSchema("jore")
    .select()
    .from("import_status")
    .orderBy("import_end", "desc")
    .limit(1);

  console.log(result);
  return result;
}

export async function getLatestExportFile() {
  if (!FTP_PASSWORD || !FTP_USERNAME || !FTP_HOST) {
    return "";
  }

  const latestImported = await getLatestImportedFile();
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

    return get(newestFile, "name", "");
  } catch (err) {
    console.log(err);
    return "";
  }
}
