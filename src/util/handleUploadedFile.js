import path from 'path'
import fs from 'fs-extra'
import { reportError } from '../monitor'

const cwd = process.cwd()
const uploadPath = path.join(cwd, 'uploads')

export const handleUploadedFile = async (uploadedFile) => {
  const fileName = `${uploadedFile.name.replace('.zip', '')}-downloaded.zip`
  const storagePath = path.join(uploadPath, fileName)

  await fs.emptyDir(uploadPath)

  return new Promise((resolve, reject) => {
    uploadedFile.mv(storagePath, async (err) => {
      if (err) {
        await reportError(
          `Moving the downloaded file ${fileName} to storage after upload failed.`
        )
        reject(err)
        return
      }

      resolve(storagePath)
    })
  })
}
