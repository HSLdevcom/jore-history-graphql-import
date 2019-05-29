/*const fs = require("fs");
const readline = require("readline");
const getMemoryStats = require("./util/getMemoryStats");
const createPrimaryKey = require("./util/createPrimaryKey");
const parseLine = require("./util/parseLine");*/
import fs from "fs-extra";
import readline from "readline";

const isWhitespaceOnly = /^\s*$/;

export async function parseDat(filename, fields, tableName, knex, st, onChunk) {
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

          const { available, used } = getMemoryStats();

          // Wait and process chunks if we're using three fourths of the memory already
          // OR we have 100 promises to await.
          if ((available / 4) * 3 <= used) {
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

// A version of parseDat where the rows should be grouped by keys.
// The array of strings provided as "groupBy" defines the properties
// that the rows should be grouped by.
export async function parseDatInGroups(
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

    lineReader.on("line", async (line) => {
      try {
        // The group key of the current line
        let groupKey = "";
        let parsedLine = null;

        if (!isWhitespaceOnly.test(line)) {
          parsedLine = parseLine(line, fields, knex, st);
          groupKey = createPrimaryKey(parsedLine, groupBy);

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
              const { available, used } = getMemoryStats();

              // Wait and process chunks if we're using three fourths of the memory already
              if ((available / 4) * 3 <= used) {
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
