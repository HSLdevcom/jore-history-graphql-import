import readline from "readline";
import iconv from "iconv-lite";

const isWhitespaceOnly = /^\s*$/;

function lineProcessor(input, output, callback) {
  const lineReader = readline.createInterface({ input, historySize: 0, terminal: false });

  lineReader.on("line", (line) => {
    if (!isWhitespaceOnly.test(line)) {
      callback(line, output);
    }
  });

  lineReader.on("close", () => {
    output.end();
  });

  return output;
}

function replaceGeometryIndexes() {
  let index = 1;
  let previous;

  return (line, stream) => {
    const lineId = line.substr(0, 24);
    index = lineId === previous ? index + 1 : 1;
    const indexPadded = `${"0".repeat(4 - index.toString().length)}${index}`;
    const lineIndexed = `${line.substr(0, 32)}${indexPadded}${line.slice(36)}`;
    stream.write(`${lineIndexed}\n`);

    if (line !== lineIndexed) {
      console.log(`Replaced invalid geometry index: ${lineId}`);
    }

    previous = lineId;
  };
}

function processLines(fileStream, output, name) {
  const writer = (line, stream) => {
    stream.write(line);
  };

  const processor = name === "reittimuoto.dat" ? replaceGeometryIndexes() : writer;
  return lineProcessor(fileStream, output, processor);
}

export async function preprocess(fileStream, outputStream) {
  const name = fileStream.path;
  const recoded = fileStream
    .pipe(iconv.decodeStream("ISO-8859-1"))
    .pipe(iconv.encodeStream("utf8"));

  return processLines(recoded, outputStream, name);
}
