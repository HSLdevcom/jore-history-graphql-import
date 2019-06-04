import { getKnex } from "./knex";

const { knex } = getKnex();

const statusTable = "import_status";
const schema = "jore";

export async function getLatestImportedFile() {
  return knex
    .withSchema(schema)
    .first()
    .from(statusTable)
    .orderBy("import_start", "desc");
}

export const startImport = async (filename) => {
  const hasRecord = await knex
    .withSchema(schema)
    .first("filename")
    .from(statusTable)
    .where({ filename });

  if (hasRecord) {
    return knex
      .withSchema(schema)
      .from(statusTable)
      .where({ filename })
      .update({
        import_end: null,
        success: false,
      });
  }

  return knex
    .withSchema(schema)
    .insert({
      filename,
      import_end: null,
      success: false,
    })
    .into(statusTable);
};

export const importCompleted = async (filename, isSuccess = true) => {
  return knex
    .withSchema(schema)
    .from(statusTable)
    .where({ filename })
    .update({
      import_end: knex.raw("NOW()"),
      success: isSuccess,
    });
};
