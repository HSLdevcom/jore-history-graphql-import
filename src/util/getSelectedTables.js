import schema from "../schema";
import { pick, compact } from "lodash";

export const getSelectedTables = (input) => {
  const [...selectedTableNames] = input || process.argv.slice(2);

  const selectedTables =
    selectedTableNames.length === 0
      ? Object.keys(schema).filter((tn) => tn !== "departure")
      : selectedTableNames;

  const selectedSchema =
    selectedTables.length !== 0
      ? Object.values(pick(schema, selectedTables))
      : Object.values(schema);

  const selectedFiles = compact(selectedSchema.map(({ filename }) => filename));

  return { selectedTables, selectedFiles, selectedSchema };
};
