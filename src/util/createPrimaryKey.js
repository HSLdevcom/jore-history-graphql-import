export function createPrimaryKey(item, keys = []) {
  const primaryKeys = keys.length ? keys : Object.keys(item);
  primaryKeys.sort(); // Ensure the same order for all keys. Sort sorts in place.
  return primaryKeys.map((key) => item[key] || `${key}:null`).join("_");
}
