import childProcess from 'child_process'
import { JORE_PG_CONNECTION } from '../constants'
import path from 'path'
import fs from 'fs-extra'

const MAX_FILE_AGE = 3600000 * 24 * 120 // 14 days
const MIN_FILE_COUNT = 10
const cwd = process.cwd()
const dumpsDir = path.join(cwd, 'dumps')

export const deleteFiles = ({ filesDir, minFileCount }) => {
  fs.readdir(filesDir, (err, files) => {
    if (files.length < minFileCount) return
    files.forEach((file) => {
      const removableFile = path.join(filesDir, file)
      fs.stat(removableFile, async (err, stat) => {
        if (err) {
          return console.error(err)
        }
        const now = new Date().getTime()
        const endTime = new Date(stat.ctime).getTime() + MAX_FILE_AGE
        if (now > endTime) {
          return fs.remove(removableFile, async (err) => {
            if (err) {
              return console.error(err)
            }
            console.log(`Deleted ${removableFile}`)
          })
        }
      })
    })
  })
}

export const createDbDump = async () => {
  console.log('Creating a DB dump')

  const startTime = process.hrtime()
  let lastError = null

  await fs.ensureDir(dumpsDir)

  // This creates a "rolling" dump since the data is always incrementally updated
  // and it wouldn't make sense to separate the dumps per day.
  const fileName = 'jore_dump_history_rolling'
  const filePath = path.join(dumpsDir, fileName)
  const fileExists = await fs.pathExists(filePath)

  deleteFiles({ filesDir: path.join(cwd, 'downloads'), minFileCount: MIN_FILE_COUNT })

  if (fileExists) {
    // Remove the old dump if it exists
    await fs.remove(filePath)
  }

  return new Promise((resolve, reject) => {
    console.log(`Dumping the ${JORE_PG_CONNECTION.database} database into ${filePath}`)

    let dumpProcess

    // Catch errors coming from the spawning itself, like ENOMEM
    try {
      dumpProcess = childProcess.spawn('pg_dump', [`-f ${filePath}`, '-Fc', '-n jore'], {
        cwd,
        shell: true,
        env: {
          PGUSER: JORE_PG_CONNECTION.user,
          PGPASSWORD: JORE_PG_CONNECTION.password,
          PGHOST: JORE_PG_CONNECTION.host,
          PGPORT: JORE_PG_CONNECTION.port,
          PGDATABASE: JORE_PG_CONNECTION.database,
        },
      })
    } catch (err) {
      reject(err)
    }

    dumpProcess.stderr.on('data', (data) => {
      lastError = data.toString('utf8')
      console.log('Dump error:', lastError)
    })

    dumpProcess.on('close', (code) => {
      const [execDuration] = process.hrtime(startTime)

      if (code !== 0) {
        console.log(`DB dump failed after ${execDuration} seconds.`)
        reject(lastError)
      } else {
        console.log(`DB dump finished successfully in ${execDuration} seconds.`)
        resolve(filePath)
      }
    })
  })
}
