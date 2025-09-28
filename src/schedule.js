import { CronJob } from 'cron'
import { DAILY_TASK_SCHEDULE } from './constants'

let scheduledImport = null

export function scheduleImport(task) {
  if (scheduledImport) {
    scheduledImport.stop()
  }

  scheduledImport = new CronJob(
    DAILY_TASK_SCHEDULE, // The cron config
    task, // The task to execute
    null, // The callback passed to the task
    false, // Start right now (we want to wait until start() is called)
    null, // time zone
    null, // Context
    false, // Run on init (we want to wait until the cron fires)
    3 // UTC offset, safer than requiring knowledge about timezones
  )
}

// Start the clock for the task. If "run on init" for the task is true, the task
// will run, otherwise only the clock is started.
export function startScheduledImport() {
  if (scheduledImport) {
    scheduledImport.start()
  }
}
