/* Превращает шаблон и значения полей в готовые блоки документа.
   Незаполненные поля остаются заметными заглушками: движок ничего не додумывает. */
(function (root, factory) {
  const node = typeof require === "function";
  const api = factory(node ? require("./russian.js") : root.Russian, node ? require("./court-fees.js") : root.CourtFees);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TemplateEngine = api;
})(globalThis, function (Russian, CourtFees) {
  "use strict";

  const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;
  const helpers = { ...Russian, ...CourtFees };

  function allFields(template) {
    return template.sections.flatMap((section) => section.fields);
  }

  function isVisible(item, values) {
    return !item.when || Boolean(item.when(values));
  }

  function visibleFields(template, values) {
    return allFields(template).filter((field) => isVisible(field, values));
  }

  /** Дополняет значения полей их значениями по умолчанию. */
  function withDefaults(template, values) {
    const merged = { ...values };
    for (const field of allFields(template)) {
      if (merged[field.id] === undefined && field.default !== undefined) merged[field.id] = field.default;
    }
    return merged;
  }

  function isFilled(field, values) {
    const value = values[field.id];
    if (field.type === "checkbox") return true;
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function formatValue(field, value) {
    switch (field.type) {
      case "money": return Russian.moneyText(value);
      case "date": return Russian.dateText(value);
      case "select": {
        const option = field.options.find((item) => item.value === value);
        return option ? (option.text ?? option.label) : null;
      }
      default: {
        const text = String(value ?? "").trim();
        return text || null;
      }
    }
  }

  function computedRun(key, template, values, usedMissing) {
    const item = template.computed[key];
    const value = item.value(values, helpers);
    if (value !== null && value !== undefined) return { text: value, field: item.field };
    usedMissing.add(item.field);
    return { text: `[${item.hint}]`, missing: true, field: item.field };
  }

  function toRuns(text, fieldsById, values, usedMissing, template) {
    const runs = [];
    let position = 0;
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      if (match.index > position) runs.push({ text: text.slice(position, match.index) });
      position = match.index + match[0].length;
      if (template.computed && template.computed[match[1]]) {
        runs.push(computedRun(match[1], template, values, usedMissing));
        continue;
      }
      const field = fieldsById.get(match[1]);
      if (!field) throw new Error(`В шаблоне нет поля ${match[1]}`);
      const visible = isVisible(field, values);
      const formatted = visible ? formatValue(field, values[field.id]) : null;
      if (formatted !== null) {
        runs.push({ text: formatted, field: field.id });
        // Дата заканчивается на «г.», поэтому точка конца предложения была бы лишней
        if (formatted.endsWith(".") && text[position] === ".") position += 1;
      } else {
        usedMissing.add(field.id);
        runs.push({ text: `[${field.hint || field.label.toLowerCase()}]`, missing: true, field: field.id });
      }
    }
    if (position < text.length) runs.push({ text: text.slice(position) });
    return runs;
  }

  function resolve(text, values) {
    return typeof text === "function" ? text(values) : text;
  }

  function renderSignatures(block, values, convert) {
    return {
      type: "signatures",
      parties: block.parties.map((party) => ({
        role: party.role,
        lines: resolve(party.lines, values).map(convert),
        signer: party.signer ? convert(resolve(party.signer, values)) : [],
      })),
    };
  }

  /** Собирает документ, нумеруя разделы и пункты только среди видимых блоков. */
  function render(template, values) {
    const fieldsById = new Map(allFields(template).map((field) => [field.id, field]));
    const usedMissing = new Set();
    const convert = (text) => toRuns(text, fieldsById, values, usedMissing, template);
    const blocks = [];
    let section = 0;
    let clause = 0;

    for (const block of template.body) {
      if (!isVisible(block, values)) continue;
      if (block.type === "signatures") {
        blocks.push(renderSignatures(block, values, convert));
        continue;
      }
      let number = null;
      if (block.type === "heading") {
        section += 1;
        clause = 0;
        number = `${section}.`;
      } else if (block.type === "clause") {
        clause += 1;
        number = `${section}.${clause}.`;
      }
      const output = { type: block.type, number, runs: convert(resolve(block.text, values)) };
      if (block.right !== undefined) output.right = convert(resolve(block.right, values));
      blocks.push(output);
    }

    const visible = visibleFields(template, values);
    const required = visible.filter((field) => !field.optional && field.type !== "checkbox");
    return {
      blocks,
      missing: [...usedMissing],
      progress: { filled: required.filter((field) => isFilled(field, values)).length, total: required.length },
    };
  }

  function runsToText(runs) {
    return runs.map((run) => run.text).join("");
  }

  /** Плоский текст документа для копирования. */
  function toPlainText(blocks) {
    const lines = [];
    for (const block of blocks) {
      if (block.type === "signatures") {
        for (const party of block.parties) {
          lines.push("", party.role, ...party.lines.map(runsToText), `____________ / ${runsToText(party.signer)}`);
        }
        continue;
      }
      if (block.type === "signatureLine") {
        lines.push("", `____________ / ${runsToText(block.runs)}	${runsToText(block.right || [])}`);
        continue;
      }
      const text = runsToText(block.runs);
      lines.push([block.number, text].filter(Boolean).join(" ") + (block.right ? `\t${runsToText(block.right)}` : ""));
      if (block.type === "heading") lines.splice(-1, 0, "");
    }
    return lines.join("\n").replace(/ /g, " ").trim();
  }

  /** Подсказка о формате значения. Предупреждает, но не мешает заполнять. */
  function validateField(field, value) {
    const text = String(value ?? "").trim();
    if (!text) return null;
    switch (field.type) {
      case "money": return Russian.parseMoney(text) === null ? "Введите сумму цифрами, например 150 000 или 150 000,50." : null;
      case "date": return Russian.parseDate(text) ? null : "Проверьте дату.";
      case "inn": return Russian.isValidInn(text) ? null : "ИНН не сходится: нужно 10 или 12 цифр с верным контрольным числом.";
      case "ogrn": return Russian.isValidOgrn(text) ? null : "ОГРН не сходится: нужно 13 цифр с верным контрольным числом.";
      case "ogrnip": return Russian.isValidOgrnip(text) ? null : "ОГРНИП не сходится: нужно 15 цифр с верным контрольным числом.";
      case "vin": return Russian.isValidVin(text) ? null : "Обычно VIN содержит 17 символов без букв I, O и Q. Сверьте с документами.";
      default: return null;
    }
  }

  return { render, toPlainText, runsToText, validateField, visibleFields, isVisible, allFields, withDefaults, helpers };
});
