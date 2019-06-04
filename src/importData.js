import { upsert } from "./util/upsert";
import schema from "./schema";
import { pick, orderBy, get, uniq, groupBy } from "lodash";
import pEachSeries from "p-each-series";
import { getPrimaryConstraint } from "./util/getPrimaryConstraint";
import PQueue from "p-queue";
import { getKnex } from "./knex";
import split from "split2";
import through from "through2";
import { parseLine } from "./util/parseLine";
import { createPrimaryKey } from "./util/createPrimaryKey";

const { knex, st } = getKnex();
const SCHEMA = "jore";
const queue = new PQueue({ concurrency: 50 });

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

export async function parseFile(fileStream, fields, tableName, onChunk) {
  return new Promise((resolve, reject) => {
    const promises = [];
    let lines = [];

    fileStream
      .pipe(split())
      .pipe(
        through({ objectMode: true }, (line, enc, cb) => {
          const str = enc === "buffer" ? line.toString("utf8") : line;
          const parsedLine = parseLine(str, fields, knex, st);
          cb(null, parsedLine);
        }),
      )
      .on("data", (line) => {
        lines.push(line);

        if (lines.length >= 500) {
          promises.push(onChunk(lines));
          lines = [];
        }
      })
      .on("end", async () => {
        if (lines.length !== 0) {
          promises.push(onChunk(lines));
        }

        try {
          await Promise.all(promises);
          fileStream.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
  });
}

// A version of parseDat where the rows should be grouped by keys.
// The array of strings provided as "groupBy" defines the properties
// that the rows should be grouped by.
export async function parseFileInGroups(
  fileStream,
  fields,
  groupKeys,
  tableName,
  onChunk,
) {
  return new Promise((resolve, reject) => {
    // All groups in a chunk. Will be reset when a chunk is sent to the db.
    let groups = [];

    // The current group of lines. Will be pushed onto `groups` when completed.
    let currentGroup = [];
    // The current key of the group. When this changes, the group is deemed complete.
    let currentGroupKey = "";

    // All promises currently going.
    const promises = [];

    fileStream
      .pipe(split())
      .pipe(
        through({ objectMode: true }, (line, enc, cb) => {
          const str = enc === "buffer" ? line.toString("utf8") : line;
          const parsedLine = parseLine(str, fields, knex, st);
          cb(null, parsedLine);
        }),
      )
      .on("data", async (parsedLine) => {
        const groupKey = createPrimaryKey(parsedLine, groupKeys);

        // If the current group key is empty, that means that this is the first line.
        if (currentGroupKey === "") {
          currentGroupKey = groupKey;
        }

        // Add the line to the current group if the group key matches.
        if (groupKey !== "" && groupKey === currentGroupKey) {
          currentGroup.push(parsedLine);
        } else if (groupKey !== "" && groupKey !== currentGroupKey) {
          // If the key does not match, that means that this line is the start of the next
          // group. Add the current group to the groups collection.
          groups.push(currentGroup);

          // Start a new group by setting the new group key and resetting the group array.
          // This line is already part of the new group so it should also be included.
          currentGroupKey = groupKey;
          currentGroup = [parsedLine];

          // If the chuck size is large enough, send it to `onChunk`.
          if (groups.length >= 1000) {
            // Get a promise for the processing of the chunk and add it to the promises array.
            promises.push(onChunk(groups));
            // Reset the groups collection for the next chunk.
            groups = [];
          }
        }
      })
      .on("end", async () => {
        if (currentGroup.length !== 0) {
          groups.push(currentGroup);
        }

        if (groups.length !== 0) {
          promises.push(onChunk(groups));
        }

        try {
          await Promise.all(promises);
          fileStream.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
  });
}

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
async function importTable(tableName, fileStream) {
  const primaryKeys = getIndexForTable(tableName);
  // Get the primary constraint for the table
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  return knex.transaction(async (trx) => {
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

    return parseFile(fileStream, schema[tableName].fields, tableName, onChunk);
  });
}

// Import the geometry data from the point_geometry data with conversion
async function importGeometry(fileStream) {
  const tableName = "geometry";
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  return knex.transaction(async (trx) => {
    const onChunk = (groups) =>
      queue.add(() => {
        console.log(`Importing ${groups.length} geometry lines to ${tableName}`);

        // Convert the groups of points into geometry objects
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

    return parseFileInGroups(
      fileStream,
      schema.point_geometry.fields,
      primaryKeys,
      tableName,
      onChunk,
    );
  });
}

export function getImportOrder(selectedTables = []) {
  if (selectedTables.length === 0) {
    return { serial: importSerial, parallel: importParallel };
  }

  return groupBy(
    selectedTables,
    (tableName) => (importSerial.includes(tableName) ? "serial" : "parallel"),
  );
}

function onImportError(err) {
  console.error(err);
  console.log("Import failed");
  throw err;
}

export async function importSerially(serialFiles) {
  try {
    return pEachSeries(
      orderBy(
        Object.entries(serialFiles),
        ([tableName]) => importSerial.indexOf(tableName) + 1,
        "asc",
      ),
      ([tableName, fileStream]) => {
        if (fileStream) {
          return importTable(tableName, fileStream);
        }

        return null;
      },
    );
  } catch (err) {
    return onImportError(err);
  }
}

export async function importInParallel(parallelFiles) {
  try {
    const ops = Object.entries(parallelFiles).map(([tableName, fileStream]) => {
      if (!fileStream) {
        return Promise.resolve(null);
      }

      if (tableName === "geometry") {
        // Special treatment for the geometry data, since it is reading from
        // point_geometry, converting those into geometry groups and inserting
        // into the geometry table.
        return importGeometry(fileStream);
      }

      return importTable(tableName, fileStream);
    });

    return Promise.all(ops);
  } catch (err) {
    return onImportError(err);
  }
}
