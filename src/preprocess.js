import iconv from "iconv-lite";
import through from "through2";
import split from "split2";
import { flow } from "lodash";

const isWhitespaceOnly = /^\s*$/;

function replaceLinebreaks() {
  let lines = [];

  return (line, lineLength) => {
    lines = [...lines, line];
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

    if (line !== lineIndexed) {
      console.log(`Replaced invalid geometry index: ${lineId}`);
    }

    previous = lineId;
    return `${lineIndexed}\n`;
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

  return fileStream.pipe(split()).pipe(
    through((chunk, enc, cb) => {
      const str = enc === "buffer" ? chunk.toString("utf8") : chunk;

      if (str.length > maxLength) {
        maxLength = str.length;
      }

      if (!isWhitespaceOnly.test(str)) {
        const linebreaksReplacedStr = lineBreaksReplacer(str, maxLength);

        if (!linebreaksReplacedStr) {
          cb();
          return;
        }

        const filteredString = filters(linebreaksReplacedStr);

        if (name === "reittimuoto.dat") {
          cb(null, geometryReplacer(filteredString));
        } else {
          cb(null, filteredString);
        }

        return;
      }

      cb();
    }),
  );
}

export function preprocess(fileStream) {
  const name = fileStream.path;

  const recoded = fileStream
    .pipe(iconv.decodeStream("ISO-8859-1"))
    .pipe(iconv.encodeStream("utf8"));

  return processLines(recoded, name);
}
