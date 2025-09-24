import path from 'path'
import { setFileError } from '../importStatus'
import { reportError } from '../monitor'

export async function catchFileError(filePath, duration = 0) {
  const fileName = path.basename(filePath)
  const message = `Downloaded file *${fileName}* is corrupted and cannot be opened. Trying an older file.`

  console.log(message)
  await reportError(message)

  await setFileError(fileName, duration)
}
