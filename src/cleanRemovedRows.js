import schema from "./schema";
import iconv from "iconv-lite";
import split from "split2";
import { processLine } from "./preprocess";
import { createQueue } from "./util/createQueue";
import { map, collect } from "etl";
import { getIndexForTable, createLineParser, NS_PER_SEC } from "./database";
import { getKnex } from "./knex";
import { GEOMETRY_TABLE_NAME, QUEUE_SIZE } from "./constants";
import { uniqBy } from "lodash";
import { createPrimaryKey } from "./util/createPrimaryKey";

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
      console.log(`Removing ${dataBatch.length} rows from ${tableName}.`)
      let removeRows = dataBatch;

      if (tableName === GEOMETRY_TABLE_NAME) {
        // The raw geometry data is one row per point, which is combined into a line when importing.
        // Thus there are many rows in the data which match the primary key. This causes deadlocks
        // when deleting, so the rows need to be reduced to unique rows only.
        removeRows = uniqBy(dataBatch, (item) => createPrimaryKey(item, primaryKeys));
      }

      let removeQueries = [];

      for (let data of removeRows) {
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

  // Collects all incoming data into one chunk.
  // Needed for the geometry table as the rows must be unique.
  function collectAll(data) {
    this.buffer.push(data);
  }

  let collectArg = tableName === GEOMETRY_TABLE_NAME ? collectAll : 1000;

  lineParser.pipe(collect(collectArg)).pipe(
    map((itemBatch) => {
      queueAdd(() => remover(itemBatch));
    }),
  );

  return lineParser;
}

export async function cleanupRowsFromFile(file) {
  const { queueAdd, onQueueEmpty } = createQueue(QUEUE_SIZE);
  let removedRows = 0;

  function countRemoved(removed = 0) {
    removedRows += removed;
  }

  let time = [0, 0];
  let tableName = "";

  await new Promise((resolve, reject) => {
    time = process.hrtime();
    tableName = getTableNameFromFileName(file.path);

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
