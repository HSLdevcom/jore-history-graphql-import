module.exports = function createPrimaryKey(item, keys = []) {
  const primaryKeys = keys.length ? keys : Object.keys(item);
  primaryKeys.sort(); // Sort sorts in place
  return primaryKeys.map((key) => item[key] || "null").join("_");
};
