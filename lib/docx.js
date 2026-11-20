/* Собирает файл Word из блоков документа. Внешних зависимостей нет.
   .docx состоит из XML-файлов в ZIP-архиве, здесь архив пишется без сжатия. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Docx = api;
})(globalThis, function () {
  "use strict";

  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>';
  const TEXT_WIDTH_TWIPS = 9355;

  function escapeXml(text) {
    return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function run(text, { bold = false, size = 24, highlight = false } = {}) {
    const properties = `${FONT}${bold ? "<w:b/>" : ""}${highlight ? '<w:highlight w:val="yellow"/>' : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`;
    const parts = text.split("\t").map((part) => `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`);
    return `<w:r><w:rPr>${properties}</w:rPr>${parts.join("<w:tab/>")}</w:r>`;
  }

  function runs(items, options) {
    return items.map((item) => run(item.text, { ...options, highlight: Boolean(item.missing) })).join("");
  }

  function paragraph(content, { align = "both", after = 120, before = 0, indentLeft = 0, firstLine = 0, tabs = "", keepNext = false } = {}) {
    const indent = indentLeft || firstLine ? `<w:ind w:left="${indentLeft}" w:firstLine="${firstLine}"/>` : "";
    return `<w:p><w:pPr>${keepNext ? "<w:keepNext/>" : ""}${tabs}<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>${indent}<w:jc w:val="${align}"/></w:pPr>${content}</w:p>`;
  }

  function signatureCell(party) {
    const lines = party.lines.map((line) => paragraph(runs(line, { size: 22 }), { align: "left", after: 40 }));
    return `<w:tc><w:tcPr><w:tcW w:w="${TEXT_WIDTH_TWIPS / 2}" w:type="dxa"/></w:tcPr>` +
      paragraph(run(party.role, { bold: true }), { align: "left", after: 80 }) +
      lines.join("") +
      paragraph(run("____________ / ") + runs(party.signer), { align: "left", before: 360, after: 0 }) +
      "</w:tc>";
  }

  function signatureTable(block) {
    const width = Math.floor(TEXT_WIDTH_TWIPS / block.parties.length);
    const grid = block.parties.map(() => `<w:gridCol w:w="${width}"/>`).join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>` +
      `<w:tr><w:trPr><w:cantSplit/></w:trPr>${block.parties.map(signatureCell).join("")}</w:tr></w:tbl>` +
      paragraph("", { after: 0 });
  }

  function blockToXml(block) {
    const numbered = (items) => (block.number ? [{ text: `${block.number} ` }, ...items] : items);
    switch (block.type) {
      case "title": return paragraph(runs(block.runs, { bold: true, size: 28 }), { align: "center", after: 60, keepNext: true });
      case "subtitle": return paragraph(runs(block.runs, { bold: true }), { align: "center", after: 240, keepNext: true });
      case "meta": {
        const tabs = `<w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH_TWIPS}"/></w:tabs>`;
        return paragraph(runs(block.runs) + run("\t") + runs(block.right || []), { align: "left", after: 240, tabs });
      }
      case "heading": return paragraph(runs(numbered(block.runs), { bold: true }), { align: "center", before: 200, after: 120, keepNext: true });
      case "address": return paragraph(runs(block.runs), { align: "left", indentLeft: 4500, after: 40 });
      case "item": return paragraph(runs(block.runs), { indentLeft: 709, after: 60 });
      case "signatures": return signatureTable(block);
      case "signatureLine": {
        const tabs = `<w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH_TWIPS}"/></w:tabs>`;
        return paragraph(run("____________ / ") + runs(block.runs) + run("\t") + runs(block.right || []), { align: "left", before: 480, tabs });
      }
      case "clause": return paragraph(runs(numbered(block.runs)));
      // разрыв страницы: в шаблонах не встречается, нужен сборнику документов для юриста (tools/build_review_docx.js)
      case "pageBreak": return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      default: return paragraph(runs(block.runs), { firstLine: 709 });
    }
  }

  function documentXml(blocks) {
    const section = '<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="567" w:gutter="0"/></w:sectPr>';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${blocks.map(blockToXml).join("")}${section}</w:body></w:document>`;
  }

  function footerXml() {
    const field = (kind, content = "") => `<w:r><w:rPr>${FONT}<w:sz w:val="20"/></w:rPr>${kind}${content}</w:r>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}><w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
      field('<w:fldChar w:fldCharType="begin"/>') + field('<w:instrText xml:space="preserve"> PAGE </w:instrText>') + field('<w:fldChar w:fldCharType="end"/>') +
      "</w:p></w:ftr>";
  }

  const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>';
  const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const DOCUMENT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>';

  const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function littleEndian(...pairs) {
    const bytes = [];
    for (const [value, size] of pairs) {
      for (let index = 0; index < size; index++) bytes.push(Math.floor(value / 256 ** index) & 0xff);
    }
    return bytes;
  }

  function zipStored(files) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const { name, content } of files) {
      const nameBytes = encoder.encode(name);
      const data = encoder.encode(content);
      const crc = crc32(data);
      // версия 2.0, UTF-8 в именах, без сжатия, дата 01.01.2000
      const common = littleEndian([20, 2], [0x0800, 2], [0, 2], [0, 2], [0x2821, 2], [crc, 4], [data.length, 4], [data.length, 4], [nameBytes.length, 2], [0, 2]);
      const local = [...littleEndian([0x04034b50, 4]), ...common];
      chunks.push(Uint8Array.from(local), nameBytes, data);
      central.push(Uint8Array.from([
        ...littleEndian([0x02014b50, 4], [20, 2]), ...common,
        ...littleEndian([0, 2], [0, 2], [0, 2], [0, 4], [offset, 4]),
      ]), nameBytes);
      offset += local.length + nameBytes.length + data.length;
    }

    const centralSize = central.reduce((sum, part) => sum + part.length, 0);
    const end = Uint8Array.from(littleEndian([0x06054b50, 4], [0, 2], [0, 2], [files.length, 2], [files.length, 2], [centralSize, 4], [offset, 4], [0, 2]));
    const parts = [...chunks, ...central, end];
    const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let position = 0;
    for (const part of parts) {
      output.set(part, position);
      position += part.length;
    }
    return output;
  }

  function build(blocks) {
    return zipStored([
      { name: "[Content_Types].xml", content: CONTENT_TYPES },
      { name: "_rels/.rels", content: ROOT_RELS },
      { name: "word/document.xml", content: documentXml(blocks) },
      { name: "word/_rels/document.xml.rels", content: DOCUMENT_RELS },
      { name: "word/footer1.xml", content: footerXml() },
    ]);
  }

  return { build, MIME: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
});
