import childProcess from "child_process";
import { JORE_PG_CONNECTION } from "../constants";
import path from "path";
import fs from "fs-extra";

const cwd = process.cwd();
const dumpsDir = path.join(cwd, "dumps");

export const createDbDump = async () =>
  new Promise(async (resolve, reject) => {
    console.log("Creating a DB dump");

    const startTime = process.hrtime();
    let lastError = null;

    let fileName;
    let filePath;
    let fileExists;

    try {
      await fs.ensureDir(dumpsDir);

      // This creates a "rolling" dump since the data is always incrementally updated
      // and it wouldn't make sense to separate the dumps per day.
      fileName = "jore_dump_history_rolling";
      filePath = path.join(dumpsDir, fileName);
      fileExists = await fs.pathExists(filePath);

      if (fileExists) {
        // Remove the old dump if it exists
        await fs.remove(filePath);
      }
    } catch (err) {
      reject(err);
    }

    console.log(`Dumping the ${JORE_PG_CONNECTION.database} database into ${filePath}`);

    let dumpProcess;

    try {
      dumpProcess = childProcess.spawn("pg_dump", [`-f ${filePath}`, "-Fc"], {
        cwd,
        shell: true,
        env: {
          PGUSER: JORE_PG_CONNECTION.user,
          PGPASSWORD: JORE_PG_CONNECTION.password,
          PGHOST: JORE_PG_CONNECTION.host,
          PGPORT: JORE_PG_CONNECTION.port,
          PGDATABASE: JORE_PG_CONNECTION.database,
        },
      });
    } catch (err) {
      reject(err);
    }

    dumpProcess.stderr.on("data", (data) => {
      lastError = data.toString("utf8");
      console.log("Dump error:", lastError);
    });

    dumpProcess.on("close", (code) => {
      const [execDuration] = process.hrtime(startTime);

      if (code !== 0) {
        console.log(`DB dump failed after ${execDuration} seconds.`);
        reject(lastError);
      } else {
        console.log(`DB dump finished successfully in ${execDuration} seconds.`);
        resolve(filePath);
      }
    });
  });
