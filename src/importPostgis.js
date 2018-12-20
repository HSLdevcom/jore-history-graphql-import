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
  } else {
    return null;
  }
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
      if (
        name &&
        (_.get(field, "primary", false) || _.get(field, "unique", false))
      ) {
        indexNames.push(name);
      }

      return indexNames;
    },
    [],
  );

  const uniqueIndices = _.uniq([...indices, ...compoundPrimary]);
  return uniqueIndices;
}

knex
  .transaction(async (trx) => {
    const createGeometrySQL = await fs.readFile(
      path.join(__dirname, "createGeometry.sql"),
      "utf8",
    );

    async function importTable(tableName) {
      const indexColumns = getIndexForTable(tableName);

      return knex.transaction((tableTrx) =>
        readTable(tableName, (lines) =>
          upsert({
            db: tableTrx,
            tableName: `jore.${tableName}`,
            itemData: lines,
            conflictTarget: indexColumns,
          }),
        ),
      );
    }

    // These tables are depended upon through foreign keys, so they need to
    // be imported first and in this order.
    await importTable("stop_area");
    await importTable("terminal");
    await importTable("stop");

    const ops = [
      importTable("line"),
      importTable("route"),
      importTable("route_segment"),
      importTable("point_geometry"),
      importTable("departure"),
      // importTable("note"),
      importTable("equipment"),
    ];

    await Promise.all(ops);

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
