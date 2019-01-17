const fs = require("fs-extra");
const path = require("path");
const upsert = require("./util/upsert");
const parseDat = require("./parseDat");
const schema = require("./schema");
const _ = require("lodash");
const pEachSeries = require("p-each-series");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
  pool: {
    min: 0,
    max: 1000,
  },
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const sourcePath = (filename) =>
  path.join(__dirname, "..", "processed", filename);

async function readTable(tableName, onChunk) {
  const filepath = sourcePath(schema[tableName].filename);
  const fileExists = await fs.exists(filepath);

  if (fileExists) {
    return parseDat(
      filepath,
      schema[tableName].fields,
      tableName,
      knex,
      st,
      onChunk,
    );
  }

  return null;
}

function getIndexForTable(tableName) {
  const tableSchema = _.get(schema, tableName, false);
  const compoundPrimary = _.get(tableSchema, "primary", []);

  const indices = _.get(tableSchema, "fields", []).reduceRight(
    (indexNames, field) => {
      const name = _.get(field, "name", "");

      if (compoundPrimary.indexOf(name) !== -1) {
        return indexNames;
      }

      // If this field is an unique index, we're interested in it. Do not add
      // non-unique indices here.
      if (name && _.get(field, "primary", false)) {
        indexNames.push(name);
      }

      return indexNames;
    },
    [],
  );

  return _.uniq([...indices, ...compoundPrimary]);
}

const importSerial = ["stop_area", "terminal", "stop"];
const importParallel = [
  "line",
  "route",
  "route_segment",
  "point_geometry",
  "departure",
  "equipment",
];

knex
  .transaction(async (trx) => {
    async function importTable(tableName) {
      const indices = getIndexForTable(tableName);
      console.log(`Starting import: ${tableName}`);

      return knex.transaction(async (tableTrx) => {
        try {
          await readTable(tableName, (lines) =>
            upsert({
              knex,
              schema: "jore",
              trx: tableTrx,
              tableName,
              itemData: lines,
              indices,
            }),
          );
        } catch (err) {
          tableTrx.rollback(err);
        }

        return tableTrx.commit();
      });
    }

    // eslint-disable-next-line no-unused-vars,no-use-before-define
    const [_firstArg, _secondArg, ...selectedTables] = process.argv;

    console.log(
      "Importing:",
      selectedTables.length !== 0 ? selectedTables : "all",
    );

    let ops = [Promise.resolve()];

    if (selectedTables.length === 0) {
      // These tables are depended upon through foreign keys, so they need to
      // be imported first and in this order.
      await pEachSeries(importSerial, (tableName) => importTable(tableName));
      ops = importParallel.map(importTable);
    } else {
      // If a table from the importSerial table is selected, import them all as they
      // may have some dependencies between them.
      if (_.intersection(importSerial, selectedTables).length !== 0) {
        await pEachSeries(importSerial, (tableName) => importTable(tableName));
      }

      // Create import promises from the selected tables.
      ops = _.intersection(importParallel, selectedTables).map(importTable);
    }

    let promise = ops.length !== 0 ? Promise.all(ops) : Promise.resolve();

    if (
      selectedTables.indexOf("geometry") !== -1 ||
      selectedTables.length === 0
    ) {
      await promise;

      const createGeometrySQL = await fs.readFile(
        path.join(__dirname, "createGeometry.sql"),
        "utf8",
      );

      promise = trx.raw(createGeometrySQL);
    }

    // Return the promise for the transaction
    return promise;
  })
  .then(() => console.log("Import succeeded."))
  .catch((err) => {
    console.error(err);
  })
  .finally(() => {
    knex.destroy();
    process.exit(0);
  });
