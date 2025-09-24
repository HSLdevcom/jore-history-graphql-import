import { fetchExportFromFTP } from './sources/fetchExportFromFTP'
import { reportError } from './monitor'
import { importFile } from './import'
import { endImport, beginImport } from './index'

export const runFtpImport = async () => {
  console.log('Importing from FTP.')

  let success = false
  let tries = 0

  if (beginImport()) {
    while (!success && tries < 10) {
      let fileToImport = null

      try {
        fileToImport = await fetchExportFromFTP()
      } catch (err) {
        await reportError('Downloading the file failed.')
        success = false
      }

      if (fileToImport) {
        success = await importFile(fileToImport).catch(reportError)
      } else {
        // If there are no files to import (ie the newest import is already done)
        // set success to true to stop this task from being retried.
        success = true
      }

      tries++
    }

    if (!success) {
      await reportError(
        'The daily task failed after 10 unsuccessful attempts and the server exited.'
      )
      process.exit(1)
    }
  }

  endImport()
}

export const runFileImport = async (filePath) => {
  console.log(`Importing from file ${filePath}`)

  if (beginImport()) {
    try {
      await importFile(filePath)
    } catch (importError) {
      console.log(`Importing from file ${filePath} failed.`)
      await reportError(importError)
      console.error(importError)
    }
  }

  endImport()
}
