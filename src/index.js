/* eslint-disable consistent-return */
import { getKnex } from './knex.js'
import { scheduleImport, startScheduledImport } from './schedule.js'
import { server } from './server.js'
import { reportError, reportInfo } from './monitor.js'
import { runFtpImport } from './importRunners.js'
import { recoverFromCrash } from './util/recoverFromCrash.js'

const { knex } = getKnex()
// logQueryTime(knex);

// The global state that informs the app if an import task is running.
// Always check this state before starting an import.
let isImporting = false

// Marks the global isImporting state as true, blocking other imports.
// Also acts as a guard that can be used in if-statements.
export const beginImport = () => {
  if (isImporting) {
    return false
  }

  isImporting = true
  return isImporting
}

// Sets the global isImporting state to false, allowing future import tasks to proceed.
export const endImport = () => {
  isImporting = false
  return true
}
;(async () => {
  // console.log('Initializing DB...')
  // await knex.migrate.latest()

  server(() => isImporting)
  await reportInfo('Server started.')

  await recoverFromCrash()

  // This is the daily scheduled task that runs the import.
  scheduleImport(runFtpImport)

  // Start the task for the daily import as soon as the server starts.
  // This will only start the timer, not run the task.
  startScheduledImport()
})()

const onExit = async () => {
  console.log('Ctrl-C...')
  await reportInfo('Process was closed, probably on purpose.')
  await knex.destroy()
  process.exit(0)
}

const onCrash = async (e) => {
  console.log('Uncaught Exception...')
  console.error(e)
  await reportError(`Uncaught exception: ${e.message || 'Something happened!'}`)
  await knex.destroy()
  process.exit(99)
}

// catch ctrl+c event and exit normally
process.on('SIGINT', onExit)

// catch uncaught exceptions, trace, then exit normally
process.on('uncaughtException', onCrash)
process.on('SIGABRT', onCrash)
