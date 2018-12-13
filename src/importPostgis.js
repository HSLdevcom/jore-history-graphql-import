const fs = require("fs-extra");
const path = require("path");
const upsert = require("./util/upsert");
const parseDat = require("./parseDat");
const schema = require("./schema");
const _ = require("lodash");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const sourcePath = (filename) =>
  path.join(__dirname, "..", "processed", filename);

async function readTable(tableName, trx) {
  return parseDat(
    sourcePath(schema[tableName].filename),
    schema[tableName].fields,
    trx,
    tableName,
    st,
  );
}

function getIndexForTable(tableName) {
  const tableSchema = _.get(schema, tableName, false);
  const indices = _.get(tableSchema, "fields", []).reduceRight(
    (indexNames, field) => {
      const name = _.get(field, "name", "");

      // If this field is an unique index, we're interested in it. Do not add
      // non-unique indices here.
      if (
        (_.get(field, "primary", false) || _.get(field, "unique", false)) &&
        name
      ) {
        indexNames.push(name);
      }

      return indexNames;
    },
    [],
  );

  return indices;
}

async function insertLines(lines, tableName, trx) {
  const indexColumns = getIndexForTable(tableName);
  const chunks = _.chunk(lines, 2000);

  for (const linesChunk of chunks) {
    console.time("Upsert");

    await upsert({
      db: trx,
      tableName: `jore.${tableName}`,
      itemData: linesChunk,
      conflictTarget: indexColumns,
    });

    console.timeEnd("Upsert");
  }
}

knex
  .transaction(async (trx) => {
    const createGeometrySQL = await fs.readFile(
      path.join(__dirname, "createGeometry.sql"),
      "utf8",
    );

    async function importTable(tableName) {
      const lines = await readTable(tableName, trx);
      await insertLines(lines, tableName, trx);
    }

    await importTable("stop_area");
    await importTable("terminal");
    await importTable("stop");
    await importTable("line");
    await importTable("route");
    await importTable("route_segment");
    await importTable("point_geometry");
    await importTable("departure");
    await importTable("note");
    await importTable("equipment");

    return trx.raw(createGeometrySQL);
  })
  .then(() => console.log("Import succeeded."))
  .catch((err) => {
    console.error(err);
  })
  .finally(() => {
    knex.destroy();
    process.exit(1);
  });
