import iconv from "iconv-lite";
import through from "through2";
import split from "split2";
import { flow } from "lodash";

const isWhitespaceOnly = /^\s*$/;

function replaceLinebreaks() {
  let lines = [];

  return (line, lineLength) => {
    lines.push(line);

    const currentLength = lines.join("\n").length;
    let output = "";

    if (currentLength > lineLength) {
      output = `${lines.join("\n")}\n`;
      console.log(`Did not replace linebreak(s):\n${output}`);
      lines = [];
    }
    if (currentLength === lineLength) {
      output = `${lines.join("  ")}\n`;
      if (lines.length > 1) console.log(`Replaced linebreak(s):\n${output}`);
      lines = [];
    }

    return output;
  };
}

function replaceGeometryIndexes() {
  let index = 1;
  let previous;

  return (line) => {
    const lineId = line.substr(0, 24);
    index = lineId === previous ? index + 1 : 1;
    const indexPadded = `${"0".repeat(4 - index.toString().length)}${index}`;
    const lineIndexed = `${line.substr(0, 32)}${indexPadded}${line.slice(36)}`;

    /*if (line !== lineIndexed) {
      console.log(`Replaced invalid geometry index: ${lineId}`);
    }*/

    previous = lineId;
    return lineIndexed;
  };
}

function removeRowsAffectedJunk(str) {
  return str.replace(/\(.*rows affected\)$/g, "");
}

function processLines(fileStream, name) {
  const geometryReplacer = replaceGeometryIndexes();
  const lineBreaksReplacer = replaceLinebreaks();

  const filters = flow(removeRowsAffectedJunk);
  let maxLength = 0;
  let firstLine = true;

  return fileStream.pipe(split()).pipe(
    through({ objectMode: true }, (chunk, enc, cb) => {
      const str = enc === "buffer" ? chunk.toString("utf8") : chunk;

      if (str && !isWhitespaceOnly.test(str)) {
        if (str.length > maxLength) {
          maxLength = str.length;
        }

        if (firstLine) {
          console.log(`Replacing line breaks on ${name}...`);
        }
        const linebreaksReplacedStr = lineBreaksReplacer(str, maxLength);

        if (!linebreaksReplacedStr) {
          cb();
          return;
        }

        if (firstLine) {
          console.log(`Filtering data in ${name}...`);
        }

        const filteredString = filters(linebreaksReplacedStr);

        if (name === "reittimuoto.dat") {
          if (firstLine) {
            console.log(`Fixing geometry indices on ${name}...`);
          }
          cb(null, geometryReplacer(filteredString));
        } else {
          cb(null, filteredString);
        }

        firstLine = false;
        return;
      }

      cb();
    }),
  );
}

export function handleFile() {
  const fileHandler = through.obj((file, enc, cb) => {
    const name = file.path;
    console.log(`Re-encoding ${name} as UTF-8...`);
    const recoded = file
      .pipe(iconv.decodeStream("ISO-8859-1"))
      .pipe(iconv.encodeStream("utf8"));

    console.log(`Preprocessing ${name}...`);
    const lineStream = processLines(recoded, name);
    cb;
  });

  return fileHandler;
}
