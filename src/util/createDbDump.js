import childProcess from "child_process";
import { JORE_PG_CONNECTION } from "../constants";
import path from "path";
import fs from "fs-extra";
import format from "date-fns/format";

const currentDate = format(new Date(), "YYYY-MM-DD");
const cwd = process.cwd();
const dumpsDir = path.join(cwd, "dumps");

export const createDbDump = async () => {
  return new Promise(async (resolve, reject) => {
    console.log("Creating a DB dump");

    const startTime = process.hrtime();
    let lastError = null;

    await fs.ensureDir(dumpsDir);
    const currentDateFilename = `jore_dump_${currentDate}`;
    const filePath = path.join(dumpsDir, currentDateFilename);
    const fileExists = await fs.pathExists(filePath);

    if (fileExists) {
      console.log("Dump exists, exiting.");
      resolve(filePath);
    } else {
      console.log(`Dumping the ${JORE_PG_CONNECTION.database} database into ${filePath}`);

      const dumpProcess = childProcess.spawn(
        "pg_dump",
        [`-f ${filePath}`, "-Fc", "-N '*old'", "-N '*new'"],
        {
          cwd,
          shell: true,
          env: {
            PGUSER: JORE_PG_CONNECTION.user,
            PGPASSWORD: JORE_PG_CONNECTION.password,
            PGHOST: JORE_PG_CONNECTION.host,
            PGPORT: JORE_PG_CONNECTION.port,
            PGDATABASE: JORE_PG_CONNECTION.database,
          },
        },
      );

      dumpProcess.stderr.on("data", (data) => {
        lastError = data.toString("utf8");
        console.log("Dump error:", lastError);
      });

      /*dumpProcess.stdout.on("data", (data) => {
        console.log("Dump output:", data.toString("utf8"));
      });*/

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
    }
  });
};