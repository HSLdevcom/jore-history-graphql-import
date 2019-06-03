import { ReadableStreamBuffer } from "stream-buffers";
import { sortedUniq, orderBy, identity } from "lodash";

export async function bufferStream(stream) {
  return new Promise((resolve, reject) => {
    // Store file data chunks in this array
    const chunks = [];

    // An error occurred with the stream
    stream.once("error", (err) => {
      // Be sure to handle this properly!
      reject(err);
    });

    // File is done being read
    stream.once("end", () => {
      // create the final data Buffer from data chunks;
      const chunkLength = sortedUniq(
        orderBy(
          chunks.map((chunk) => Buffer.byteLength(chunk, "utf8")),
          identity,
          "desc",
        ),
      );

      const fileBuffer = Buffer.concat(chunks);

      const streamBuffer = new ReadableStreamBuffer({
        frequency: 1, // in milliseconds.
        chunkSize: chunkLength[0], // in bytes.
      });

      streamBuffer.put(fileBuffer);
      streamBuffer.stop();

      resolve(streamBuffer);
    });

    // Data is flushed from stream in chunks,
    // this callback will be executed for each chunk
    stream.on("data", (chunk) => {
      chunks.push(chunk);
    });
  });
}
