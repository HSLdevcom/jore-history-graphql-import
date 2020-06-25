import { mapValues, orderBy } from "lodash";
import fs from "fs-extra";

const SECRETS_PATH = "/run/secrets/";

// For any env variable with the value of "secret", resolve the actual value from the
// associated secrets file. Using sync fs methods for the sake of simplicity,
// since this will only run once when staring the app, sync is OK.
const secrets = (fs.existsSync(SECRETS_PATH) && fs.readdirSync(SECRETS_PATH)) || [];

const secretsEnv = mapValues(process.env, (value, key) => {
  const matchingSecrets = secrets.filter((secretFile) => secretFile.startsWith(key));

  const currentSecret =
    orderBy(
      matchingSecrets,
      (secret) => {
        const secretVersion = parseInt(secret[secret.length - 1], 10);
        return isNaN(secretVersion) ? 0 : secretVersion;
      },
      "desc",
    )[0] || null;

  const filepath = SECRETS_PATH + currentSecret;

  if (fs.existsSync(filepath)) {
    return (fs.readFileSync(filepath, { encoding: "utf8" }) || "").trim();
  }

  return value;
});

export const JORE_PG_CONNECTION = {
  host: secretsEnv.JORE_POSTGRES_HOST,
  port: secretsEnv.JORE_POSTGRES_PORT,
  user: secretsEnv.JORE_POSTGRES_USER,
  password: secretsEnv.JORE_POSTGRES_PASSWORD,
  database: secretsEnv.JORE_POSTGRES_DB,
  ssl: secretsEnv.JORE_POSTGRES_SSL === "true",
};

export const FTP_USERNAME = secretsEnv.FTP_USERNAME || "";
export const FTP_PASSWORD = secretsEnv.FTP_PASSWORD || "";
export const FTP_HOST = secretsEnv.FTP_HOST || "";
export const FTP_PORT = secretsEnv.FTP_PORT || 21;
export const FTP_PATH = secretsEnv.FTP_PATH || "/";
export const DAILY_TASK_SCHEDULE = secretsEnv.DAILY_TASK_SCHEDULE || "0 0 1 * * *";
export const DEBUG = secretsEnv.DEBUG || "false";
export const SERVER_PORT = secretsEnv.SERVER_PORT || 3000;
export const ADMIN_PASSWORD = secretsEnv.ADMIN_PASSWORD || "password";
export const PATH_PREFIX = secretsEnv.PATH_PREFIX || "/";
export const AZURE_STORAGE_ACCOUNT = secretsEnv.AZURE_STORAGE_ACCOUNT || "";
export const AZURE_STORAGE_KEY = secretsEnv.AZURE_STORAGE_KEY || "";
export const AZURE_UPLOAD_CONTAINER =
  secretsEnv.AZURE_UPLOAD_CONTAINER || "jorehistorydumps";
export const SLACK_WEBHOOK_URL = secretsEnv.SLACK_WEBHOOK_URL || "";
export const SLACK_MONITOR_MENTION = secretsEnv.SLACK_MONITOR_MENTION || "";
export const ENVIRONMENT = secretsEnv.ENVIRONMENT || "unknown";

// There are some special considerations for the geometry table
export const GEOMETRY_TABLE_NAME = "geometry";

export const BATCH_SIZE = 2000;
export const QUEUE_SIZE = 10;
