const fs = require("fs-extra");
const path = require("path");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const parseDat = require("./parseDat");
const tables = require("./schema");

const sourcePath = (filename) =>
  path.join(__dirname, "..", "processed", filename);

knex
  .transaction(async (trx) => {
    function loadTable(tableName) {
      return parseDat(
        sourcePath(tables[tableName].filename),
        tables[tableName].fields,
        trx,
        tableName,
        st,
      );
    }

    const createGeometrySQL = await fs.readFile(
      path.join(__dirname, "createGeometry.sql"),
      "utf8",
    );

    await loadTable("terminal");
    await loadTable("stop_area");
    await loadTable("stop");
    await loadTable("terminal_group");
    await loadTable("line");
    await loadTable("route");
    await loadTable("route_segment");
    await loadTable("point_geometry");
    await loadTable("departure");
    await loadTable("note");

    return trx.raw(createGeometrySQL);
  })
  .then(() => console.log("Import succeeded."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => knex.destroy());
