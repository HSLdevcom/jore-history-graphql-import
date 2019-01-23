const fs = require("fs");
const readline = require("readline");
const _ = require("lodash");
const v8 = require("v8");

const isWhitespaceOnly = /^\s*$/;

function parseLine(line, fields, knex, st) {
  const values = {};
  let index = 1;

  fields.forEach(({ length, name, type, defaultTo }) => {
    if (name) {
      let value = line.substring(index, index + length).trim();

      if (!value && defaultTo) {
        value = defaultTo;
      }

      if (value.length === 0) {
        values[name] = null;
      } else if (type === "decimal") {
        values[name] = parseFloat(value);
        if (Number.isNaN(values[name])) {
          throw new Error(
            `Failed to parse value for field ${name}. Line:\n${line}`,
          );
        }
      } else if (type === "integer") {
        values[name] = parseInt(value, 10);
        if (Number.isNaN(values[name])) {
          throw new Error(
            `Failed to parse value for field ${name}. Line:\n${line}`,
          );
        }
      } else if (type === "date") {
        if (value.length !== 8) {
          throw new Error(
            `Invalid value ${value} for field ${name}. Line:\n${line}`,
          );
        }
        values[name] = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(
          6,
          8,
        )}`;
      } else {
        values[name] = value;
      }
    }
    index += length;
  });

  if (typeof values.lat !== "undefined" && typeof values.lon !== "undefined") {
    values.point = st.geomFromText(
      `POINT(${_.get(values, "lon", 0)} ${_.get(values, "lat", 0)})`,
      4326,
    );
  } else if (
    typeof values.x !== "undefined" &&
    typeof values.y !== "undefined"
  ) {
    values.point = knex.raw(
      `ST_Transform(ST_GeomFromText('POINT(${_.get(values, "x", 0)} ${_.get(
        values,
        "y",
        0,
      )})',2392),4326)`,
    );
  }

  return values;
}

function parseDat(
  filename,
  fields,
  tableName,
  knex,
  st,
  onChunk,
  chunkWaitLimit = 100,
) {
  return new Promise((resolve, reject) => {
    let lines = [];

    const lineReader = readline.createInterface({
      input: fs.createReadStream(filename),
    });

    let promises = [];

    lineReader.on("line", async (line) => {
      try {
        if (!isWhitespaceOnly.test(line)) {
          const parsedLine = parseLine(line, fields, knex, st);
          lines.push(parsedLine);
        }

        if (lines.length >= 1000) {
          lineReader.pause();
          promises.push(onChunk(lines));
          lines = [];

          const memoryStats = v8.getHeapStatistics();
          const used = Math.abs(memoryStats.used_heap_size / 1024 / 1024);
          const available = Math.abs(memoryStats.heap_size_limit / 1024 / 1024);

          // Wait and process chunks if we're using three fourths of the memory already
          // OR we have 100 promises to await.
          if (
            (available / 4) * 3 <= used ||
            promises.length >= chunkWaitLimit
          ) {
            console.log(
              `Processing ${promises.length} chunks of ${tableName}.`,
            );

            await Promise.all(promises);
            promises = [];
          }

          lineReader.resume();
        }
      } catch (error) {
        reject(error);
      }
    });

    lineReader.on("close", () => {
      if (lines.length !== 0) {
        promises.push(onChunk(lines));
      }

      Promise.all(promises)
        .then(resolve)
        .catch(reject);
    });
  });
}

function parseDatInGroups(
  filename,
  fields,
  groupBy,
  knex,
  st,
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

    const lineReader = readline.createInterface({
      input: fs.createReadStream(filename),
    });

    // All promises currently going.
    let promises = [];

    // Creates the key that identifies a group.
    function getGroupKey(line) {
      return _.sortBy(Object.entries(_.pick(line, groupBy)), ([key]) => key)
        .map(([_, value]) => value)
        .join("_");
    }

    lineReader.on("line", async (line) => {
      try {
        // The group key of the current line
        let groupKey = "";
        let parsedLine = null;

        if (!isWhitespaceOnly.test(line)) {
          parsedLine = parseLine(line, fields, knex, st);
          groupKey = getGroupKey(parsedLine);

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
            if (groups.length >= 100) {
              lineReader.pause();

              // Get a promise for the processing of the chunk and add it to the promises array.
              promises.push(onChunk(groups));
              // Reset the groups collection for the next chunk.
              groups = [];

              // Check the memory situation...
              const memoryStats = v8.getHeapStatistics();
              const used = Math.abs(memoryStats.used_heap_size / 1024 / 1024);
              const available = Math.abs(
                memoryStats.heap_size_limit / 1024 / 1024,
              );

              // Wait and process chunks if we're using three fourths of the memory already
              if ((available / 4) * 3 <= used) {
                console.log(
                  `Processing ${promises.length} chunks of ${tableName}.`,
                );

                await Promise.all(promises);
                promises = [];
              }

              lineReader.resume();
            }
          }
        }
      } catch (error) {
        reject(error);
      }
    });

    lineReader.on("close", () => {
      if (currentGroup.length !== 0) {
        groups.push(currentGroup);
      }

      if (groups.length !== 0) {
        promises.push(onChunk(groups));
      }

      Promise.all(promises)
        .then(resolve)
        .catch(reject);
    });
  });
}

module.exports = { parseDat, parseDatInGroups };
