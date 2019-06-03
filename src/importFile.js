import path from "path";
import { upsert } from "./util/upsert";
import { parseDat, parseDatInGroups } from "./parseDat";
import schema from "./schema";
import { pick, orderBy, get, uniq, groupBy, mapValues } from "lodash";
import pEachSeries from "p-each-series";
import { getPrimaryConstraint } from "./util/getPrimaryConstraint";
import PQueue from "p-queue";
import { getKnex } from "./knex";

const { knex, st } = getKnex();
const SCHEMA = "jore";
const queue = new PQueue({ concurrency: 1000 });

function getIndexForTable(tableName) {
  const tableSchema = get(schema, tableName, false);
  const compoundPrimary = get(tableSchema, "primary", []);

  const indices = get(tableSchema, "fields", []).reduceRight((indexNames, field) => {
    const name = get(field, "name", "");

    if (compoundPrimary.indexOf(name) !== -1) {
      return indexNames;
    }

    // If this field is an unique index, we're interested in it. Do not add
    // non-unique indices here.
    if (name && get(field, "primary", false)) {
      indexNames.push(name);
    }

    return indexNames;
  }, []);

  return uniq([...indices, ...compoundPrimary]);
}

// Import a table from a corresponding .dat file
async function importTable(tableName, fileStream, trx) {
  const primaryKeys = getIndexForTable(tableName);

  // Get the primary constraint for the table
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const onChunk = (lines) =>
    queue.add(() => {
      console.log(`Importing ${lines.length} lines to ${tableName}`);

      return upsert({
        knex,
        schema: SCHEMA,
        trx,
        tableName,
        itemData: lines,
        indices: primaryKeys,
        constraint,
      });
    });

  return parseDat(fileStream, schema[tableName].fields, tableName, knex, st, onChunk);
}

// Import the geometry data from the point_geometry data with conversion
async function importGeometry(fileStream, trx) {
  const tableName = "geometry";
  const primaryKeys = getIndexForTable(tableName);

  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const onChunk = (groups) =>
    queue.add(() => {
      console.log(`Importing ${groups.length} geometry lines to ${tableName}`);

      // Convert the groups of points into geography objects
      const geometryItems = groups.map((group) => {
        // All objects have the primary keys in common
        const geometryData = pick(group[0], primaryKeys);

        // Extract the points of the group
        const points = orderBy(group, "index", "ASC").map(({ point }) => point);

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
    fileStream,
    schema.point_geometry.fields,
    primaryKeys,
    knex,
    st,
    tableName,
    onChunk,
  );
}

export function getImportOrder(selectedTables = []) {
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

  if (selectedTables.length === 0) {
    return { serial: importSerial, parallel: importParallel };
  }

  return mapValues(
    groupBy(
      selectedTables,
      (tableName) => (importSerial.includes(tableName) ? "serial" : "parallel"),
    ),
    (tableNames, group) => {
      if (group === "serial") {
        return orderBy(tableNames, (tableName) => importSerial.indexOf(tableName) + 1);
      }

      return orderBy(tableNames, (tableName) => importParallel.indexOf(tableName) + 1);
    },
  );
}

function onImportError(err) {
  console.error(err);
  console.log("Import failed");
  throw err;
}

export async function importSerialFiles(serialFiles) {
  try {
    return knex.transaction(async (trx) => {
      await pEachSeries(Object.entries(serialFiles), ([tableName, fileStream]) => {
        if (fileStream) {
          return importTable(tableName, fileStream, trx);
        }

        return null;
      });
    });
  } catch (err) {
    return onImportError(err);
  }
}

export async function importParallelFiles(parallelFiles) {
  try {
    return knex.transaction(async (trx) => {
      const ops = Object.entries(parallelFiles).map(([tableName, fileStream]) => {
        if (!fileStream) {
          return Promise.resolve(null);
        }

        if (tableName === "geometry") {
          // Special treatment for the geometry data, since it is reading from
          // point_geometry, converting those into geometry groups and inserting
          // into the geometry table.
          return importGeometry(fileStream, trx);
        }

        return importTable(tableName, fileStream, trx);
      });

      return Promise.all(ops);
    });
  } catch (err) {
    return onImportError(err);
  }
}
