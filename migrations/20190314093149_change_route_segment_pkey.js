exports.up = async function(knex) {
  await knex.schema.withSchema("jore").table("route_segment", (table) => {
    table.dropPrimary();
    table.dropUnique(
      [],
      "route_segment_route_id_direction_date_begin_date_end_stop_id_un",
    );

    table.primary([
      "route_id",
      "direction",
      "date_begin",
      "date_end",
      "stop_index",
    ]);
  });
};

exports.down = async function() {
  return Promise.resolve();
};
