import { upsert } from "./util/upsert";
import schema from "./schema";
import { pick, orderBy, get, uniq } from "lodash";
import { getPrimaryConstraint } from "./util/getPrimaryConstraint";
import { getKnex } from "./knex";
import split from "split2";
import through from "through2";
import { parseLine } from "./util/parseLine";
import { createPrimaryKey } from "./util/createPrimaryKey";
import branch from "branch-pipe";
import PQueue from "p-queue";
import { map, collect } from "etl";

const { knex, st } = getKnex();
const SCHEMA = "jore";

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
        through.obj((line, enc, cb) => {
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

const createImportStreamForTable = async (tableName, queue) => {
  const primaryKeys = getIndexForTable(tableName);
  // Get the primary constraint for the table
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const chunkImportStream = collect(1000, 1000);

  chunkImportStream.pipe(
    map((batch) => {
      const itemData = batch.map(({ data }) => data);

      queue.add(() =>
        knex.transaction((trx) => {
          console.log(`Importing ${itemData.length} lines to ${tableName}`);

          return upsert({
            knex,
            schema: SCHEMA,
            trx,
            tableName,
            itemData,
            indices: primaryKeys,
            constraint,
          });
        }),
      );
    }),
  );

  return chunkImportStream;
};

// Import the geometry data from the point_geometry data with conversion
async function importGeometry() {
  const tableName = "geometry";
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  return async (groups) =>
    knex.transaction((trx) => {
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
}

function onImportError(err) {
  console.error(err);
  console.log("Import failed");
  throw err;
}

export async function importStream(selectedTables, lineStream) {
  const tableStreams = {};
  const queue = new PQueue({ concurrency: 30 });

  for (const tableName of selectedTables) {
    if (tableName !== "geometry") {
      tableStreams[tableName] = await createImportStreamForTable(tableName, queue);
    }
  }

  return new Promise((resolve, reject) => {
    lineStream
      .pipe(
        through.obj((lineObj, enc, cb) => {
          const { tableName, line } = lineObj;
          let parsedLine = null;
          const { fields } = schema[tableName];
          const stream = tableStreams[tableName];

          if (line === null && stream) {
            console.log(`Ending ${tableName} stream...`);
            stream.end();
            tableStreams[tableName] = null;
          } else if (stream) {
            try {
              parsedLine = parseLine(line, fields);
              tableStreams[tableName].write({ tableName, data: parsedLine || null });
            } catch (err) {
              cb(err);
              return;
            }
          }

          cb();
        }),
      )
      .on("finish", () => {
        setTimeout(() => {
          resolve(queue.onEmpty());
        }, 1000);
      })
      .on("error", reject);
  });
}
