import iconv from "iconv-lite";
import through from "through2";
import split from "split2";
import { Parse } from "unzipper";
import { PassThrough } from "stream";
import schema from "./schema";

const isWhitespaceOnly = /^\s*$/;

const getTableNameFromFileName = (filename) =>
  Object.entries(schema).find(
    ([, { filename: schemaFilename }]) => filename === schemaFilename,
  )[0];

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

    if (index === 1 && line !== lineIndexed) {
      console.log("Replacing geometry indices...");
    }

    previous = lineId;
    return lineIndexed;
  };
}

function processLines(tableName) {
  const geometryReplacer = replaceGeometryIndexes();
  const lineBreaksReplacer = replaceLinebreaks();

  let maxLength = 0;

  return through.obj(function createLine(chunk, enc, cb) {
    const str = enc === "buffer" ? chunk.toString("utf8") : chunk;

    if (str && !isWhitespaceOnly.test(str)) {
      if (str.length > maxLength) {
        maxLength = str.length;
      }

      const linebreaksReplacedStr = lineBreaksReplacer(str, maxLength);

      if (linebreaksReplacedStr) {
        let resultLine = linebreaksReplacedStr;

        if (tableName === "geometry") {
          resultLine = geometryReplacer(linebreaksReplacedStr);
        }

        this.push({ tableName, line: resultLine });
      }
    }

    cb();
  });
}

export function processArchive(archiveStream, filesToDownload = []) {
  const returnStream = new PassThrough({ objectMode: true });

  archiveStream
    .pipe(Parse())
    .pipe(
      through.obj((entry, enc, cb) => {
        if (filesToDownload.includes(entry.path)) {
          const tableName = getTableNameFromFileName(entry.path);

          entry
            .pipe(iconv.decodeStream("ISO-8859-1"))
            .pipe(iconv.encodeStream("utf8"))
            .pipe(split())
            .pipe(processLines(tableName))
            .on("data", (line) => returnStream.push(line))
            .on("finish", () => {
              returnStream.push({ tableName, line: null });
              cb();
            })
            .on("error", (err) => cb(err));
        } else {
          entry.autodrain();
          cb();
        }
      }),
    )
    .on("finish", () => returnStream.end())
    .on("error", (err) => returnStream.destroy(err));

  return returnStream;
}
