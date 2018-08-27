const detect = require("charset-detector");
const iconv = require("iconv-lite");
const peek = require("peek-stream");
const splicer = require("stream-splicer");

function convertFrom(encoding) {
  return splicer([iconv.decodeStream(encoding), iconv.encodeStream("utf8")]);
}

function getSupportedEncoding(encoding) {
  let enc = encoding;
  if (encoding === "ISO-8859-8-I") enc = "ISO-8859-8";
  if (iconv.encodingExists(enc)) return enc;
  return "utf8"; // default
}

function toutf8(options) {
  let opts = options;
  if (!options) opts = {};
  if (typeof options === "string") opts = { encoding: opts };
  const conf = opts.confidence || 0;
  const newline = opts.newline !== false;
  const detectSize = opts.detectSize || 65535;
  const setEncoding = opts.encoding;
  // encoding given
  if (setEncoding) return convertFrom(setEncoding);

  // detect encoding first
  // eslint-disable-next-line consistent-return
  return peek({ newline, maxBuffer: detectSize }, (data, swap) => {
    if (!Buffer.isBuffer(data)) return swap(new Error("No buffer"));
    const matches = detect(data);
    let encoding =
      matches.length > 0 && matches[0].confidence > conf
        ? matches[0].charsetName
        : "utf8";
    encoding = getSupportedEncoding(encoding);
    swap(null, convertFrom(encoding));
  });
}

module.exports = toutf8;
