import schema from "./schema";
import iconv from "iconv-lite";
import split from "split2";
import get from "lodash/get";
import { processLine } from "./preprocess";
import { createQueue } from "./util/createQueue";
import { map, collect } from "etl";
import { getIndexForTable, createLineParser, NS_PER_SEC } from "./database";
import { getKnex } from "./knex";
import { GEOMETRY_TABLE_NAME } from "./constants";

const { knex } = getKnex();

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) =>
      filename === `${schemaFilename.replace(".dat", "")}_removed.dat`,
  )[0];

// Create the upsert query with a transaction,
const createRemoveQuery = (tableName, primaryKeys, countRemoved) => async (dataBatch) => {
  let queryResult = [];
  let tableId = `jore.${tableName}`;

  try {
    queryResult = await knex.transaction(async (trx) => {
      let removeQueries = [];

      for (let data of dataBatch) {
        let whereFields = primaryKeys.map((pk) => `t.${pk}::text = '${data[pk]}'`);

        let removeQuery = trx.raw(
          `DELETE FROM ?? t WHERE ${whereFields.join(" AND ")};`,
          [tableId],
        );

        removeQueries.push(removeQuery);
      }

      return Promise.all(removeQueries);
    });
  } catch (err) {
    queryResult = [];
    console.log("Remove transaction error:", err);
  }

  let removedCount = queryResult.reduce((total, res) => total + res.rowCount, 0);
  console.log("removed count:", removedCount);

  countRemoved(removedCount);

  return queryResult;
};

function createRemoveStreamForTable(tableName, queueAdd, countRemoved) {
  const primaryKeys = getIndexForTable(tableName);

  if (primaryKeys.length === 0) {
    console.log(`No primary keys found for table ${tableName}, skipping remove.`);
    return false;
  }

  const remover = createRemoveQuery(tableName, primaryKeys, countRemoved);
  const lineParser = createLineParser(tableName);

  lineParser.pipe(collect(100, 1000)).pipe(
    map((itemBatch) => {
      queueAdd(() => remover(itemBatch));
    }),
  );

  return lineParser;
}

export async function cleanupRowsFromFile(file) {
  const { queueAdd, onQueueEmpty } = createQueue(100);
  let removedRows = 0;

  function countRemoved(removed = 0) {
    removedRows += removed;
  }

  let time = [0, 0];
  let tableName = "";

  await new Promise((resolve, reject) => {
    time = process.hrtime();
    tableName = getTableNameFromFileName(file.path);

    if (tableName === GEOMETRY_TABLE_NAME) {
      console.log("Not removing geometry table rows yet.");
      return resolve(tableName);
    }

    let removeStream = createRemoveStreamForTable(tableName, queueAdd, countRemoved);

    if (!removeStream) {
      return resolve(tableName);
    }

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
        console.log(`Reading remove file for table ${tableName} finished.`);
        resolve(tableName);
      })
      .on("error", (err) => {
        readStream.destroy(err);
        reject(err);
      });
  });

  await onQueueEmpty();

  const [execS, execNs] = process.hrtime(time);
  const ms = (execS * NS_PER_SEC + execNs) / 1000000;
  console.log(`${removedRows} records of ${tableName} deleted in ${ms} ms`);
}
