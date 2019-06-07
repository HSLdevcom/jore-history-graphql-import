import { CronJob } from "cron";
import { invoke } from "lodash";

export const MIDNIGHT = "0 0 0 * * *";
export const EARLY_MORNING = "0 0 3 * * *";

const scheduledImports = {};

const runningTasks = [];

function onTaskCompleted(name) {
  console.log(`Task ${name} completed.`);
  const nameIndex = runningTasks.indexOf(name);

  if (nameIndex !== -1) {
    runningTasks.splice(nameIndex, 1);
  }
}

function onTaskStart(name) {
  if (runningTasks.includes(name)) {
    console.log(`Task ${name} is already running.`);
    return false;
  }

  runningTasks.push(name);
  return true;
}

function runTask(name, task) {
  return (onComplete) => {
    if (onTaskStart(name)) {
      console.log(`Running task ${name}.`);
      task(onComplete);
    }
  };
}

export function createScheduledImport(name, cron, task) {
  const job = new CronJob(
    cron,
    runTask(name, task),
    () => onTaskCompleted(name),
    false, // Start right now (we want to wait until start() is called)
    null, // time zone
    null, // Context
    true, // Run on init
    3, // UTC offset
  );

  scheduledImports[name] = job;
}

export function startScheduledImport(name) {
  invoke(scheduledImports, `${name}.start`);
}
