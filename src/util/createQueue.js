import PQueue from "p-queue";
import { QUEUE_SIZE } from "../constants";
import { asyncWait } from "../import";

export function createQueue() {
  const queue = new PQueue({ concurrency: QUEUE_SIZE });
  let activePromises = 0;

  const queueAdd = (promiseFn) => {
    queue.add(promiseFn).then(() => {
      activePromises -= 1;
    });

    activePromises += 1;
  };

  const onQueueEmpty = async () => {
    while (activePromises > 0) {
      console.log(activePromises);
      await asyncWait(10000);
    }

    await queue.onEmpty();
  };

  return { queue, queueAdd, onQueueEmpty };
}
