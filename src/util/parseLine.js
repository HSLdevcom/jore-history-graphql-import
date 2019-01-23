const _ = require("lodash");

// Parses a line into something that can be imported into the database.
module.exports = function parseLine(line, fields, knex, st) {
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
};
