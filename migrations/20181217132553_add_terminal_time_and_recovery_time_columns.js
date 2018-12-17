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
};

exports.down = async function(knex) {
  const schema = knex.schema.withSchema("jore");

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
