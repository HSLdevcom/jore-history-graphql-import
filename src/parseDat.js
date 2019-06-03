import split from "split2";
import through from "through2";
import { parseLine } from "./util/parseLine";
import { createPrimaryKey } from "./util/createPrimaryKey";

export async function parseDat(fileStream, fields, tableName, knex, st, onChunk) {
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

        if (lines.length >= 100) {
          promises.push(onChunk(lines));
          lines = [];
        }
      })
      .on("end", () => {
        if (lines.length !== 0) {
          promises.push(onChunk(lines));
        }

        Promise.all(promises)
          .then(resolve)
          .catch(reject);
      });
  });
}

// A version of parseDat where the rows should be grouped by keys.
// The array of strings provided as "groupBy" defines the properties
// that the rows should be grouped by.
export async function parseDatInGroups(
  fileStream,
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
        const groupKey = createPrimaryKey(parsedLine, groupBy);

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

        Promise.all(promises)
          .then(resolve)
          .catch(reject);
      });
  });
}
