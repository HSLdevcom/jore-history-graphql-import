const { JORE_PG_CONNECTION } = require("./src/constants");

module.exports = {
  client: "pg",
  connection: JORE_PG_CONNECTION,
};
