import { getKnex } from './knex'
import { omit } from 'lodash'

const { knex } = getKnex()

const statusTable = 'import_status'
const schema = 'public'

export async function getLatestImportedFile() {
  return knex
    .withSchema(schema)
    .first()
    .from(statusTable)
    .where('file_error', false)
    .orderBy('import_start', 'desc')
}

export async function getErrorFiles() {
  return knex
    .withSchema(schema)
    .from(statusTable)
    .where('file_error', true)
    .orderBy('import_start', 'desc')
}

export const upsert = async (data) => {
  const { filename } = data

  const hasRecord = await knex
    .withSchema(schema)
    .first('filename')
    .from(statusTable)
    .where({ filename })

  if (hasRecord) {
    return knex
      .withSchema(schema)
      .from(statusTable)
      .where({ filename })
      .update(omit(data, 'filename'))
  }

  return knex.withSchema(schema).insert(data).into(statusTable)
}

export const startImport = async (filename) =>
  upsert({
    filename,
    import_end: null,
    success: false,
    file_error: false,
  })

export const importCompleted = async (filename, isSuccess = true, duration = 0) =>
  upsert({
    filename,
    import_end: knex.raw('NOW()'),
    success: isSuccess,
    duration,
  })

export const setFileError = async (filename, duration = 0) =>
  upsert({
    filename,
    import_end: knex.raw('NOW()'),
    success: false,
    duration,
    file_error: true,
  })
