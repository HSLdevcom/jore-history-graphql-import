const get = require("lodash/get");
const groupBy = require("lodash/groupBy");
const tables = require("../src/schema");
const tablesOld = require("../schemaVersions/schema_2019-11-21");

exports.up = async function(knex) {
  const changes = [];
  const tableEntries = Object.entries(tables);

  for (const [tableName, { fields }] of tableEntries) {
    let fieldIdx = 0;
    for (const field of fields) {
      const oldField = tablesOld[tableName].fields[fieldIdx];
      const isNotNullable = get(field, "notNullable", false);

      if (isNotNullable !== get(oldField, "notNullable", false)) {
        changes.push({
          tableName,
          fieldName: field.name,
          type: field.type,
          notNullable: isNotNullable,
          defaultValue: get(field, "defaultTo"),
        });
      }

      fieldIdx++;
    }
  }

  const alterQueries = [];

  for (const [tableName, tableChanges] of Object.entries(groupBy(changes, "tableName"))) {
    const query = knex.schema.alterTable(`jore.${tableName}`, (table) => {
      for (const change of tableChanges) {
        const column = table[change.type](change.fieldName);

        if (change.notNullable) {
          column.notNullable();
        } else {
          column.nullable();
        }

        if (change.defaultValue) {
          column.defaultTo(change.defaultValue);
        }

        column.alter();
      }
    });

    alterQueries.push(query);
  }

  return Promise.all(alterQueries);
};

exports.down = async function() {
  return Promise.resolve();
};
