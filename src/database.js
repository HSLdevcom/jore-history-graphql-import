import { upsert } from "./util/upsert";
import schema from "./schema";
import { pick, orderBy, get, uniq } from "lodash";
import { getPrimaryConstraint } from "./util/getPrimaryConstraint";
import { getKnex } from "./knex";
import through from "through2";
import { parseLine } from "./util/parseLine";
import { createPrimaryKey } from "./util/createPrimaryKey";
import { map, collect } from "etl";
import { GEOMETRY_TABLE_NAME } from "./constants";
import throughConcurrent from "through2-concurrent";

const { knex } = getKnex();
const SCHEMA = "jore";

// Creates a function that groups lines by the `groupKeys` argument.
// When the returned function is called with a line, it is either assigned
// to the current group or it becomes the start of a new group. When a group
// is concluded it is returned, otherwise undefined is returned.

//  >>> LINES MUST BE PROCESSED IN ORDER! <<<
// Note that lines MUST come in group order! Once a group is done, lines cannot
// be added to it.
export function createLineGrouper(groupKeys) {
  // The current group of lines. Will be pushed onto `groups` when completed.
  let currentGroup = [];
  // The current key of the group. When this changes, the group is deemed complete.
  let currentGroupKey = "";

  return (line) => {
    if (!line) {
      return currentGroup.length !== 0 ? currentGroup : undefined;
    }

    const groupKey = createPrimaryKey(line, groupKeys);
    let returnValue;

    // If the current group key is empty, that means that this is the first line.
    if (currentGroupKey === "") {
      currentGroupKey = groupKey;
    }

    // Add the line to the current group if the group key matches.
    if (groupKey !== "" && groupKey === currentGroupKey) {
      currentGroup.push(line);
    } else if (groupKey !== "" && groupKey !== currentGroupKey) {
      // If the key does not match, that means that this line is the start of the next
      // group. Return the current group.
      returnValue = [...currentGroup]; // Clone the group

      // Start a new group by setting the new group key and resetting the group array.
      // This line is already part of the new group so it should also be included.
      currentGroupKey = groupKey;
      currentGroup = [line];
    }

    return returnValue;
  };
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

const createQueuedQuery = (
  queue,
  itemData,
  tableName,
  primaryKeys,
  constraint,
  onBeforeQuery = () => {},
  onAfterQuery = () => {},
) => {
  const promise = new Promise((resolve, reject) => {
    onBeforeQuery();

    knex
      .transaction((trx) =>
        upsert({
          knex,
          schema: SCHEMA,
          trx,
          tableName,
          itemData,
          indices: primaryKeys,
          constraint,
        }),
      )
      .then(() => {
        onAfterQuery();
        resolve();
      })
      .catch(reject);
  });

  queue.push(promise);
};

const createLineParser = (tableName) => {
  const { fields, lineSchema = fields } = schema[tableName] || {};
  let linesReceived = false;

  const throughFunc =
    tableName === GEOMETRY_TABLE_NAME
      ? through.obj
      : throughConcurrent.obj.bind(throughConcurrent.obj, { maxConcurrency: 50 });

  return throughFunc((line, enc, cb) => {
    if (!line) {
      // line === null marks the end of the file. End the import stream
      // to flush any items left in the collect buffer.
      return cb(null, null);
    }

    if (lineSchema) {
      // This function runs on each line which would be too much to log.
      // When receiving the first line of a table, log it and mark it as logged.
      if (!linesReceived) {
        console.log(`Importing ${tableName}...`);
        linesReceived = true;
      }

      try {
        // Parse the line and return it into the stream
        const parsedLine = parseLine(line, lineSchema);
        // Write the line to the relevant import stream.
        return cb(null, parsedLine);
      } catch (err) {
        return cb(err);
      }
    }

    return cb();
  });
};

function createGeometryObjects(groups, primaryKeys) {
  return groups.map((group) => {
    // All objects have the primary keys in common
    const geometryData = pick(group[0], primaryKeys);

    // Extract the points of the group
    const points = orderBy(group, "admin.html", "ASC").map(({ point }) => point);

    // Return a geometry object with a geometric line created with PostGIS.
    return {
      ...geometryData,
      geom: knex.raw(`ST_MakeLine(ARRAY[${points.map(() => "?").join(",")}])`, points),
    };
  });
}

// Import the geometry data from the point_geometry data with conversion
export async function createImportStreamForGeometryTable(queue) {
  const tableName = GEOMETRY_TABLE_NAME;
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const lineParser = createLineParser(tableName);
  const createGroup = createLineGrouper(primaryKeys);

  let chunkIndex = 0;

  lineParser
    .pipe(through.obj((line, enc, cb) => cb(null, createGroup(line))))
    .pipe(collect(1000))
    .pipe(
      map((batch) => {
        // Convert the groups of points into geometry objects
        const geometryItems = createGeometryObjects(batch, primaryKeys);
        createQueuedQuery(
          queue,
          geometryItems,
          tableName,
          primaryKeys,
          constraint,
          () => {
            console.log(
              `${chunkIndex}. Importing ${geometryItems.length} lines to ${tableName}`,
            );
            chunkIndex++;
          },
        );
      }),
    );

  return lineParser;
}

export const createImportStreamForTable = async (tableName, queue) => {
  if (tableName === GEOMETRY_TABLE_NAME) {
    return createImportStreamForGeometryTable(queue);
  }

  const primaryKeys = getIndexForTable(tableName);
  // Get the primary constraint for the table
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const lineParser = createLineParser(tableName);
  let chunkIndex = 0;

  lineParser.pipe(collect(1000, 500)).pipe(
    map((itemData) =>
      createQueuedQuery(queue, itemData, tableName, primaryKeys, constraint, () => {
        console.log(`${chunkIndex}. Importing ${itemData.length} lines to ${tableName}`);
        chunkIndex++;
      }),
    ),
  );

  return lineParser;
};
