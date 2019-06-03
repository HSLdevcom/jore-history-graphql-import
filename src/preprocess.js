import iconv from "iconv-lite";
import through from "through2";
import split from "split2";

const isWhitespaceOnly = /^\s*$/;

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

function processLines(fileStream, name) {
  const geometryReplacer = replaceGeometryIndexes();

  return fileStream.pipe(split()).pipe(
    through((chunk, enc, cb) => {
      const str = enc === "buffer" ? chunk.toString("utf8") : chunk;

      if (!isWhitespaceOnly.test(str)) {
        if (name === "reittimuoto.dat") {
          cb(null, geometryReplacer(str));
        } else {
          cb(null, `${str.replace(/\(.*rows affected\)$/g, "")}\n`);
        }
      } else {
        cb();
      }
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
