import schema from "../schema";
import { pick, compact, difference } from "lodash";

export const getSelectedTables = (input) => {
  const [...selectedTableNames] = input || process.argv.slice(2);
  const tableNames = Object.keys(schema);

  const omitNames = selectedTableNames
    .filter((tn) => tn.startsWith("exclude:"))
    .map((tn) => tn.replace("exclude:", ""));

  const pickNames = difference(
    selectedTableNames.filter((tn) => !tn.startsWith("exclude:")),
    omitNames,
  );

  const selectedTables =
    pickNames.length === 0
      ? tableNames.filter((tn) => !omitNames.includes(tn))
      : tableNames.filter((tn) => pickNames.includes(tn));

  const selectedSchema =
    selectedTables.length !== 0
      ? Object.values(pick(schema, selectedTables))
      : Object.values(schema);

  const selectedFiles = compact(selectedSchema.map(({ filename }) => filename));

  console.log(`Importing tables: ${selectedTables.join(", ")}`);
  return { selectedTables, selectedFiles, selectedSchema };
};
