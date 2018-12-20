exports.up = async function(knex) {
  const schema = knex.schema.withSchema("jore");

  const hasEquipmentId = await schema.hasColumn("departure", "equipment_id");
  if (!hasEquipmentId) {
    await schema.table("departure", (table) => {
      table.string("equipment_id");
    });
  }

  const hasOperatorId = await schema.hasColumn("departure", "operator_id");
  if (!hasOperatorId) {
    await schema.table("departure", (table) => {
      table.string("operator_id");
    });
  }
};

exports.down = async function(knex, bluebird) {
  const schema = knex.schema.withSchema("jore");

  const columnsToDrop = ["equipment_id", "operator_id"];

  const existingColumns = await bluebird.filter(columnsToDrop, (colName) =>
    schema.hasColumn("departure", colName),
  );

  return schema.table("departure", (table) => {
    existingColumns.forEach((colName) => table.dropColumn(colName));
  });
};
