const fs = require("fs-extra");
const path = require("path");
const upsert = require("./util/upsert");
const importGeometryGroup = require("./util/importGeometryGroup");
const { parseDat, parseDatInGroups } = require("./parseDat");
const schema = require("./schema");
const _ = require("lodash");
const pEachSeries = require("p-each-series");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
  pool: {
    min: 0,
    max: 50,
  },
});

const SCHEMA = "jore";

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const sourcePath = (filename) =>
  path.join(__dirname, "..", "processed", filename);

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
  "departure",
  "equipment",
];

knex
  .transaction(async (trx) => {
    async function importGeometry() {
      const filepath = sourcePath(schema.point_geometry.filename);
      const fileExists = await fs.exists(filepath);

      const groupKeys = ["route_id", "direction", "date_begin", "date_end"];

      if (fileExists) {
        const onGroup = (group) =>
          importGeometryGroup({
            knex,
            schema: SCHEMA,
            trx,
            tableName: "geometry",
            group,
            groupKeys,
          });

        return parseDatInGroups(
          filepath,
          schema.point_geometry.fields,
          groupKeys,
          knex,
          st,
          onGroup,
        );
      }

      return Promise.resolve();
    }

    async function importTable(tableName) {
      const keys = getIndexForTable(tableName);

      const filepath = sourcePath(schema[tableName].filename);
      const fileExists = await fs.exists(filepath);

      if (fileExists) {
        const onChunk = (lines) =>
          upsert({
            knex,
            schema: SCHEMA,
            trx,
            tableName,
            itemData: lines,
            indices: keys,
          });

        return parseDat(
          filepath,
          schema[tableName].fields,
          tableName,
          knex,
          st,
          onChunk,
          isInit ? 1000 : 100,
        );
      }

      return Promise.resolve();
    }

    const [...selectedTables] = process.argv.slice(2);

    console.log(
      "Importing:",
      selectedTables.length !== 0 ? selectedTables.join(", ") : "all",
    );

    let ops = [];

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

    if (
      selectedTables.indexOf("geometry") !== -1 ||
      selectedTables.length === 0
    ) {
      const geometryPromise = await importGeometry();
      ops.push(geometryPromise);
    }

    const promise = ops.length !== 0 ? Promise.all(ops) : Promise.resolve();
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
