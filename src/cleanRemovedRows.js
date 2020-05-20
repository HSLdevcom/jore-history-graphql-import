import schema from "./schema";
import iconv from "iconv-lite";
import split from "split2";
import { processLine } from "./preprocess";
import { createQueue } from "./util/createQueue";
import { map } from "etl";
import { getIndexForTable, createLineParser } from "./database";
import { getKnex } from "./knex";

const { knex } = getKnex();

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) =>
      filename === `${schemaFilename.replace(".dat", "")}_removed.dat`,
  )[0];

// Create the upsert query with a transaction,
const createRemoveQuery = (tableName, primaryKeys) => async (data) => {
  let queryResult;
  let tableId = `jore.${tableName}`;

  let whereFields = primaryKeys.map((pk) => `t.${pk}::text = '${data[pk]}'`);

  try {
    queryResult = await knex.raw(
      `SELECT * FROM ?? t WHERE ${whereFields.join(" AND ")};`,
      [tableId],
    );

    console.log(queryResult)
  } catch (err) {
    queryResult = false;
    console.log(err);
  }

  return queryResult;
};

async function createRemoveStreamForTable(tableName, queueAdd) {
  const primaryKeys = getIndexForTable(tableName);

  const importer = createRemoveQuery(tableName, primaryKeys);
  const lineParser = createLineParser(tableName);

  lineParser.pipe(
    map((itemData) => {
      queueAdd(() => importer(itemData));
    }),
  );

  return lineParser;
}

export async function cleanupRowsFromFile(file) {
  const { queueAdd, onQueueEmpty } = createQueue();

  await new Promise((resolve, reject) => {
    const tableName = getTableNameFromFileName(file.path);

    createRemoveStreamForTable(tableName, queueAdd).then((removeStream) => {
      const readStream = file
        .stream()
        .pipe(iconv.decodeStream("ISO-8859-1"))
        .pipe(iconv.encodeStream("utf8"))
        .pipe(split())
        .pipe(processLine(tableName));

      readStream.on("error", (err) => {
        removeStream.destroy(err);
        reject(err);
      });

      readStream.pipe(removeStream);

      removeStream
        .on("finish", () => {
          console.log(`Reading file for table ${tableName} finished.`);
          resolve(tableName);
        })
        .on("error", (err) => {
          readStream.destroy(err);
          reject(err);
        });
    });
  });

  await onQueueEmpty();
}
