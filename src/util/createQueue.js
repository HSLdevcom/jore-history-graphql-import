import PQueue from 'p-queue'
import { QUEUE_SIZE } from '../constants'

export const asyncWait = (delay = 1000) =>
  new Promise((resolve) => {
    setTimeout(resolve, delay)
  })

export function createQueue(concurrency = QUEUE_SIZE) {
  const queue = new PQueue({ concurrency, autoStart: true })
  let activePromises = 0

  const queueAdd = (promiseFn) => {
    queue.add(promiseFn).then(() => {
      activePromises -= 1
    })

    activePromises += 1
  }

  const onQueueEmpty = async () => {
    while (activePromises > 0) {
      console.log('Current queue length:', activePromises)
      await asyncWait(10000)
    }

    await queue.onEmpty()
  }

  return { queue, queueAdd, onQueueEmpty }
}
