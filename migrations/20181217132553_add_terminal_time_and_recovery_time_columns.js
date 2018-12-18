exports.up = async function(knex) {
  const schema = knex.schema.withSchema("jore");

  const hasTerminalTime = await schema.hasColumn("departure", "terminal_time");
  if (!hasTerminalTime) {
    await schema.table("departure", (table) => {
      table.integer("terminal_time");
    });
  }

  const hasRecoveryTime = await schema.hasColumn("departure", "recovery_time");
  if (!hasRecoveryTime) {
    await schema.table("departure", (table) => {
      table.integer("recovery_time");
    });
  }

  const hasRequiredEquipment = await schema.hasColumn(
    "departure",
    "equipment_requirement",
  );
  if (!hasRequiredEquipment) {
    await schema.table("departure", (table) => {
      table.integer("equipment_requirement");
    });
  }
};

exports.down = async function(knex) {
  const schema = knex.schema.withSchema("jore");

  const hasRequiredEquipment = await schema.hasColumn(
    "departure",
    "equipment_requirement",
  );
  if (hasRequiredEquipment) {
    await schema.table("departure", (table) => {
      table.dropColumn("equipment_requirement");
    });
  }

  const hasRecoveryTime = await schema.hasColumn("departure", "recovery_time");
  if (hasRecoveryTime) {
    await schema.table("departure", (table) => {
      table.dropColumn("recovery_time");
    });
  }

  const hasTerminalTime = await schema.hasColumn("departure", "terminal_time");
  if (hasTerminalTime) {
    await schema.table("departure", (table) => {
      table.dropColumn("terminal_time");
    });
  }
};
