require = require("esm")(module);
require("dotenv/config");

module.exports = require("./_knexfile").default;
