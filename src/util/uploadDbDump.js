import { AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_KEY, AZURE_UPLOAD_CONTAINER } from '../constants'
import { SharedKeyCredential, BlobServiceClient } from '@azure/storage-blob'
import { AbortController } from '@azure/abort-controller'
import path from 'path'
import fs from 'fs-extra'

export const uploadDbDump = async (filePath) => {
  const account = AZURE_STORAGE_ACCOUNT
  const accountKey = AZURE_STORAGE_KEY
  const containerName = AZURE_UPLOAD_CONTAINER

  if (!account || !accountKey || !containerName) {
    console.log(
      'Azure credentials not set. Set the AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY env variables.'
    )
    throw new Error('Azure credentials not found.')
  }

  const fileExists = await fs.pathExists(filePath)

  if (!fileExists) {
    console.log('No file to upload. Exiting.')
    throw new Error('Dump file to upload not found.')
  }

  console.log(`Uploading DB dump ${filePath} to Azure.`)

  const sharedKeyCredential = new SharedKeyCredential(account, accountKey)
  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    sharedKeyCredential
  )

  const containerClient = blobServiceClient.getContainerClient(containerName)

  const blobName = path.basename(filePath)
  const blobClient = containerClient.getBlobClient(blobName)
  const blockBlobClient = blobClient.getBlockBlobClient()

  try {
    await blockBlobClient.uploadStream(fs.createReadStream(filePath), 4 * 1024 * 1024, 20, {
      abortSignal: AbortController.timeout(30 * 60 * 1000), // abort after 30 mins
    })
  } catch (err) {
    throw err
  }

  console.log('Dump upload successful.')
}
