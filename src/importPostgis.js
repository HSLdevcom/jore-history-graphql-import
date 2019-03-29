const fs = require("fs-extra");
const path = require("path");
const upsert = require("./util/upsert");
const { parseDat, parseDatInGroups } = require("./parseDat");
const schema = require("./schema");
const _ = require("lodash");
const pEachSeries = require("p-each-series");
const getPrimaryConstraint = require("./util/getPrimaryConstraint");
const PQueue = require("p-queue");

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

// Import these serially and in this order
const importSerial = ["stop_area", "terminal", "stop"];

// These can be imported in parallel in any order
const importParallel = [
  "line",
  "route",
  "route_segment",
  "departure",
  "equipment",
  "exception_days_calendar",
  "exception_days",
  "replacement_days_calendar",
];

knex
  .transaction(async (trx) => {
    const queue = new PQueue({ concurrency: 1000 });

    // Import a table from a corresponding .dat file
    async function importTable(tableName) {
      const primaryKeys = getIndexForTable(tableName);

      // Get the filename from the schema definition and check that the file exists.
      const filepath = sourcePath(schema[tableName].filename);
      const fileExists = await fs.exists(filepath);

      if (fileExists) {
        // Get the primary constraint for the table
        const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

        const onChunk = (lines) =>
          queue.add(() =>
            upsert({
              knex,
              schema: SCHEMA,
              trx,
              tableName,
              itemData: lines,
              indices: primaryKeys,
              constraint,
            }),
          );

        return parseDat(
          filepath,
          schema[tableName].fields,
          tableName,
          knex,
          st,
          onChunk,
          200,
        );
      }
    }

    // Import the geometry data from the point_geometry data with conversion
    async function importGeometry() {
      const tableName = "geometry";
      const filepath = sourcePath(schema.point_geometry.filename);
      const fileExists = await fs.exists(filepath);
      const primaryKeys = getIndexForTable(tableName);

      if (fileExists) {
        const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

        const onChunk = (groups) =>
          queue.add(() => {
            // Convert the groups of points into geography objects
            const geometryItems = groups.map((group) => {
              // All objects have the primary keys in common
              const geometryData = _.pick(group[0], primaryKeys);

              // Extract the points of the group
              const points = _.orderBy(group, "index", "ASC").map(
                ({ point }) => point,
              );

              // Return a geometry object with a geometric line created with PostGIS.
              return {
                ...geometryData,
                geom: knex.raw(
                  `ST_MakeLine(ARRAY[${points.map(() => "?").join(",")}])`,
                  points,
                ),
              };
            });

            return upsert({
              knex,
              schema: SCHEMA,
              trx,
              tableName,
              itemData: geometryItems,
              indices: primaryKeys,
              constraint,
            });
          });

        return parseDatInGroups(
          filepath,
          schema.point_geometry.fields,
          primaryKeys,
          knex,
          st,
          tableName,
          onChunk,
        );
      }
    }

    // Get the selected tables from the CLI args
    const [...selectedTables] = process.argv.slice(2);

    console.log(
      "Importing:",
      selectedTables.length !== 0 ? selectedTables.join(", ") : "all",
    );

    // The insert/update operations for the tables
    let ops = [];

    // Case: all tables selected
    if (selectedTables.length === 0) {
      // These tables are depended upon through foreign keys, so they need to
      // be imported first and in this order.
      await pEachSeries(importSerial, (tableName) => importTable(tableName));
      ops = importParallel.map(importTable);

      // Case: some tables were selected
    } else {
      // If a table from the importSerial table is selected, import them all as they
      // may have some dependencies between them.
      if (_.intersection(importSerial, selectedTables).length !== 0) {
        await pEachSeries(importSerial, (tableName) => importTable(tableName));
      }

      // Create import promises from the selected tables.
      ops = _.intersection(importParallel, selectedTables).map(importTable);
    }

    // If the geometry table was selected or if all tables were selected...
    if (
      selectedTables.indexOf("geometry") !== -1 ||
      selectedTables.length === 0
    ) {
      // Special treatment for the geometry data, since it is reading from
      // point_geometry, converting those into geometry groups and inserting
      // into the geometry table.
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
