import { ReadableStreamBuffer } from "stream-buffers";

export function bufferStream(stream, waitForBuffer = true) {
  let onError = (err) => console.error(err);
  let onComplete = () => {};

  const streamBuffer = new ReadableStreamBuffer({
    frequency: 5, // in milliseconds.
    chunkSize: 1024, // in bytes.
  });

  // Data is flushed from stream in chunks,
  // this callback will be executed for each chunk
  stream.on("data", (chunk) => {
    streamBuffer.put(chunk);
  });

  // An error occurred with the stream
  stream.once("error", (err) => {
    // Be sure to handle this properly!
    onError(err);
  });

  // File is done being read
  stream.once("end", () => {
    streamBuffer.stop();
    onComplete(streamBuffer);
  });

  if (waitForBuffer) {
    return new Promise((resolve, reject) => {
      onError = (err) => reject(err);
      onComplete = (result) => resolve(result);
    });
  }

  return streamBuffer;
}
