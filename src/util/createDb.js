const _ = require("lodash");

function createTables(schema, knexInstance, config) {
  const schemaPromises = [];

  Object.entries(config).forEach(([tableName, { fields }]) => {
    const tablePromise = knexInstance.schema
      .withSchema(schema)
      .createTable(tableName, (table) => {
        fields.forEach(
          ({
            length,
            name,
            type,
            unique,
            primary,
            index,
            typeOptions,
            notNullable,
            defaultTo,
          }) => {
            if (name && type) {
              let column; // eslint-disable-line no-unused-vars
              if (type === "string") {
                column = table.string(name, length);
              } else if (type === "decimal") {
                column = table.decimal(name, 9, 6);
              } else {
                column = table[type](name, typeOptions);
              }
              if (primary) {
                if (Array.isArray(primary)) {
                  column = column.primary(primary);
                } else {
                  column = column.primary();
                }
              }
              if (unique) {
                column = column.unique();
              }
              if (index) {
                column = column.index();
              }
              if (notNullable) {
                column = column.notNullable();
              }
              if (defaultTo) {
                column = column.defaultTo(defaultTo);
              }
            }
          },
        );
        if (
          (_.find(fields, { name: "lat" }) &&
            _.find(fields, { name: "lon" })) ||
          (_.find(fields, { name: "x" }) && _.find(fields, { name: "y" }))
        ) {
          table.specificType("point", "geometry(point, 4326)");
          table.index("point", `${tableName}_points_gix`, "GIST");
        }
      });

    schemaPromises.push(tablePromise);
  });

  return Promise.all(schemaPromises);
}

function createForeignKeys(schema, knexInstance, config) {
  const schemaPromises = [];

  Object.entries(config).forEach(([tableName, { fields, primary }]) => {
    const indexPromise = knexInstance.schema
      .withSchema(schema)
      .table(tableName, (table) => {
        if (primary) {
          table.unique(primary).primary(primary);
        }
        fields.forEach(({ name, type, foreign }) => {
          if (name && type && foreign) {
            table
              .foreign(name)
              .references(foreign.split(".")[1])
              .inTable(`jore.${foreign.split(".")[0]}`);
          }
        });
      });
    schemaPromises.push(indexPromise);
  });

  return Promise.all(schemaPromises);
}

module.exports = {
  createTables,
  createForeignKeys,
};
