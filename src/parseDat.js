const fs = require("fs");
const readline = require("readline");
const _ = require("lodash");

const isWhitespaceOnly = /^\s*$/;

function parseLine(line, fields, knex, st) {
  const values = {};
  let index = 1;

  fields.forEach(({ length, name, type }) => {
    if (name) {
      const value = line.substring(index, index + length).trim();
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

function parseDat(filename, fields, knex, tableName, st) {
  return new Promise((resolve, reject) => {
    const lines = [];

    const lineReader = readline.createInterface({
      input: fs.createReadStream(filename),
    });

    lineReader.on("line", async (line) => {
      try {
        if (!isWhitespaceOnly.test(line)) {
          const parsedLine = parseLine(line, fields, knex, st);
          lines.push(parsedLine);
        }
      } catch (error) {
        reject(error);
      }
    });

    lineReader.on("close", async () => {
      try {
        console.log(
          `Read ${lines.length} lines from ${filename} to ${tableName}`,
        );

        resolve(lines);
      } catch (error) {
        reject(error);
      }
    });
  });
}

module.exports = parseDat;
