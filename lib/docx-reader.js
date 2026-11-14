/* Достаёт текст из файла .docx прямо в браузере.
   Файл Word является ZIP-архивом. Нужен только word/document.xml: его разжимает встроенный DecompressionStream. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DocxReader = api;
})(globalThis, function () {
  "use strict";

  const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
  const CENTRAL_FILE_HEADER = 0x02014b50;
  const LOCAL_FILE_HEADER = 0x04034b50;
  const DOCUMENT_PATH = "word/document.xml";
  const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

  class DocxError extends Error {}

  function findEndOfCentralDirectory(view) {
    for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset--) {
      if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY) return offset;
    }
    throw new DocxError("Это не файл Word: архив не распознан.");
  }

  function findEntry(bytes, name) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const end = findEndOfCentralDirectory(view);
    const count = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < count; index++) {
      if (view.getUint32(offset, true) !== CENTRAL_FILE_HEADER) break;
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const entryName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (entryName === name) {
        if (view.getUint32(localOffset, true) !== LOCAL_FILE_HEADER) throw new DocxError("Файл Word повреждён.");
        const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
        return { method, data: bytes.subarray(dataStart, dataStart + compressedSize) };
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    throw new DocxError("В файле нет текста документа. Возможно, это не документ Word.");
  }

  async function inflate(data) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code) => {
      if (code[0] === "#") {
        const value = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
        return Number.isFinite(value) ? String.fromCodePoint(value) : whole;
      }
      return ENTITIES[code] ?? whole;
    });
  }

  /** Текст абзацев из word/document.xml. Удалённые правки и служебные поля пропускаются. */
  function documentXmlToText(xml) {
    const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) || [];
    return paragraphs.map((paragraph) => {
      let line = "";
      for (const match of paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br(?:\s[^>]*)?\/>|<w:cr\/>/g)) {
        if (match[1] !== undefined) line += decodeEntities(match[1]);
        else line += match[0].startsWith("<w:tab") ? "\t" : "\n";
      }
      return line;
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function readDocx(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const entry = findEntry(bytes, DOCUMENT_PATH);
    let xmlBytes;
    if (entry.method === 0) xmlBytes = entry.data;
    else if (entry.method === 8) xmlBytes = await inflate(entry.data);
    else throw new DocxError("Файл сжат неизвестным способом. Сохраните его в Word заново.");
    return documentXmlToText(new TextDecoder().decode(xmlBytes));
  }

  return { readDocx, documentXmlToText, DocxError };
});
