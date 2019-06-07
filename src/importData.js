import { upsert } from "./util/upsert";
import schema from "./schema";
import { pick, orderBy, get, uniq } from "lodash";
import { getPrimaryConstraint } from "./util/getPrimaryConstraint";
import { getKnex } from "./knex";
import through from "through2";
import { parseLine } from "./util/parseLine";
import { createPrimaryKey } from "./util/createPrimaryKey";
import { map, collect } from "etl";

const { knex } = getKnex();
const SCHEMA = "jore";

// There are some special considerations for the geometry table
const GEOMETRY_TABLE_NAME = "geometry";

// Creates a function that groups lines by the `groupKeys` argument.
// When the returned function is called with a line, it is either assigned
// to the current group or it becomes the start of a new group. When a group
// is concluded it is returned, otherwise undefined is returned.
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
  onBeforeImport = () => {},
) =>
  queue.add(() =>
    knex.transaction((trx) => {
      onBeforeImport();

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

const createImportStreamForTable = async (tableName, queue) => {
  const primaryKeys = getIndexForTable(tableName);
  // Get the primary constraint for the table
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  // Collect 1000 items and pass them forward as a chunk.
  // A chunk is emitted in a 500ms interval, so items
  // need to arrive within this time to be included.
  const chunkImportStream = collect(1000, 750);

  let chunkIndex = 0;

  chunkImportStream.pipe(
    map((itemData) =>
      createQueuedQuery(queue, itemData, tableName, primaryKeys, constraint, () => {
        console.log(`${chunkIndex}. Importing ${itemData.length} lines to ${tableName}`);
        chunkIndex++;
      }),
    ),
  );

  return chunkImportStream;
};

function createGeometryObjects(groups, primaryKeys) {
  return groups.map((group) => {
    // All objects have the primary keys in common
    const geometryData = pick(group[0], primaryKeys);

    // Extract the points of the group
    const points = orderBy(group, "index", "ASC").map(({ point }) => point);

    // Return a geometry object with a geometric line created with PostGIS.
    return {
      ...geometryData,
      geom: knex.raw(`ST_MakeLine(ARRAY[${points.map(() => "?").join(",")}])`, points),
    };
  });
}

// Import the geometry data from the point_geometry data with conversion
async function createImportStreamForGeometryTable(queue) {
  const tableName = GEOMETRY_TABLE_NAME;
  const primaryKeys = getIndexForTable(tableName);
  const constraint = await getPrimaryConstraint(knex, tableName, SCHEMA);

  const createGroup = createLineGrouper(primaryKeys);
  const geometryGroupStream = through.obj((line, enc, cb) => cb(null, createGroup(line)));

  let chunkIndex = 0;

  geometryGroupStream.pipe(collect(1000)).pipe(
    map((batch) => {
      // Convert the groups of points into geometry objects
      const geometryItems = createGeometryObjects(batch, primaryKeys);
      createQueuedQuery(queue, geometryItems, tableName, primaryKeys, constraint, () => {
        console.log(
          `${chunkIndex}. Importing ${geometryItems.length} lines to ${tableName}`,
        );
        chunkIndex++;
      });
    }),
  );

  return geometryGroupStream;
}

export async function createImportStream(selectedTables, queue) {
  const tableStreams = {};

  // Create import streams for each selected table.
  for (const tableName of selectedTables) {
    if (tableName === GEOMETRY_TABLE_NAME) {
      tableStreams[GEOMETRY_TABLE_NAME] = await createImportStreamForGeometryTable(queue);
    } else {
      tableStreams[tableName] = await createImportStreamForTable(tableName, queue);
    }
  }

  // When the first line for a table is received the table name is logged here.
  const linesReceived = [];

  return through.obj((lineObj, enc, cb) => {
    const { tableName, line } = lineObj;

    // Some tables (ie geometry) use a separate lineSchema for parsing lines.
    // The lines are then combined and inserted into the database according
    // to the fields schema.
    const { fields, lineSchema = fields } = schema[tableName] || {};

    const stream = tableStreams[tableName];

    if (line === null && stream) {
      // line === null marks the end of the file. End the import stream
      // to flush any items left in the collect buffer.
      stream.end(null);
    } else if (stream && lineSchema) {
      try {
        // This function runs on each line which would be too much to log.
        // When receiving the first line of a table, log it and mark it as logged.
        if (!linesReceived.includes(tableName)) {
          console.log(`Importing ${tableName}...`);
          linesReceived.push(tableName);
        }

        // Parse the line and write it to the import stream for the table.
        const parsedLine = parseLine(line, lineSchema);
        // Write the line to the relevant import stream.
        stream.write(parsedLine);
      } catch (err) {
        return cb(err);
      }
    }

    return cb();
  });
}
