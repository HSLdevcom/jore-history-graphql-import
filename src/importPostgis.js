const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");

const knex = require("knex")({
  dialect: "postgres",
  client: "pg",
  connection: process.env.PG_CONNECTION_STRING,
});

// install postgis functions in knex.postgis;
const st = require("knex-postgis")(knex);

const parseDat = require("./parseDat");
const tables = require("./schema");

const sourcePath = (filename) => path.join(__dirname, "..", "data", filename);

knex
  .transaction(async (trx) => {
    function loadTable(tableName) {
      return parseDat(
        sourcePath(tables[tableName].filename),
        tables[tableName].fields,
        knex,
        tableName,
        trx,
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
    await trx.raw(createGeometrySQL);
  })
  .then(() => knex.destroy())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
