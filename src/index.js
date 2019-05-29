import { preprocess } from "./preprocess";
import { runImport } from "./importPostgis";

(async () => {
  console.log("Database manager started.");
  await preprocess();
  await runImport();
  process.exit(0);
})();
