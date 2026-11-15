/* Сравнение двух редакций статьи: какие абзацы и слова добавились, а какие удалены.
   Подключается в браузере как window.TextDiff и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TextDiff = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // слово или пробелы между словами, как TOKEN_RE в editions.js
  const TOKEN_RE = /\S+|\s+/g;
  // больше клеток таблица сравнения не строится: такой абзац считается заменённым целиком
  const MAX_CELLS = 2000000;
  // абзацы считаются одним изменённым, если совпадает хотя бы такая доля слов
  const SIMILAR = 0.4;

  /** Общая подпоследовательность двух списков: пары индексов [i, j] совпадающих элементов по порядку. */
  function common(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    if (rows * cols > MAX_CELLS) return null;
    const table = new Uint32Array(rows * cols);
    for (let i = a.length - 1; i >= 0; i--) {
      for (let j = b.length - 1; j >= 0; j--) {
        table[i * cols + j] = a[i] === b[j]
          ? table[(i + 1) * cols + j + 1] + 1
          : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
      }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
      else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) i++;
      else j++;
    }
    return pairs;
  }

  /** Добавляет кусок к списку, склеивая с предыдущим того же вида. */
  function push(segments, type, text) {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  }

  /**
   * Разница двух абзацев по словам: [{ type: "same" | "removed" | "added", text }].
   * Пробел между двумя правками относится к правкам, чтобы «было три слова» → «стало три слова» читалось целиком.
   */
  function words(before, after) {
    const a = before.match(TOKEN_RE) || [];
    const b = after.match(TOKEN_RE) || [];
    // одинаковое начало и конец сравнивать не нужно: правки в законах обычно точечные
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let end = 0;
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
    const middleA = a.slice(start, a.length - end);
    const middleB = b.slice(start, b.length - end);
    const pairs = common(middleA, middleB) || [];

    const raw = [];
    push(raw, "same", a.slice(0, start).join(""));
    let i = 0;
    let j = 0;
    for (const [pi, pj] of [...pairs, [middleA.length, middleB.length]]) {
      push(raw, "removed", middleA.slice(i, pi).join(""));
      push(raw, "added", middleB.slice(j, pj).join(""));
      if (pi < middleA.length) push(raw, "same", middleA[pi]);
      i = pi + 1;
      j = pj + 1;
    }
    push(raw, "same", a.slice(a.length - end).join(""));
    return tidy(raw);
  }

  /** Короткие общие куски между правками (пробел, предлог, запятая) уходят в правку, а правки идут парой «удалено, добавлено». */
  function tidy(raw) {
    const isChange = (segment) => segment && segment.type !== "same";
    const merged = [];
    for (let index = 0; index < raw.length; index++) {
      const segment = raw[index];
      const short = segment.type === "same" && segment.text.trim().length <= 2 && index > 0 && index < raw.length - 1;
      if (short && isChange(raw[index - 1]) && isChange(raw[index + 1])) {
        merged.push({ type: "removed", text: segment.text }, { type: "added", text: segment.text });
      } else {
        merged.push({ ...segment });
      }
    }
    // внутри подряд идущих правок сначала всё удалённое, потом всё добавленное
    const result = [];
    let removed = "";
    let added = "";
    const flush = () => {
      push(result, "removed", removed);
      push(result, "added", added);
      removed = "";
      added = "";
    };
    for (const segment of merged) {
      if (segment.type === "removed") removed += segment.text;
      else if (segment.type === "added") added += segment.text;
      else { flush(); push(result, "same", segment.text); }
    }
    flush();
    return result;
  }

  /** Доля совпавших слов двух абзацев, от 0 до 1. */
  function similarity(before, after) {
    const a = before.split(/\s+/).filter(Boolean);
    const b = after.split(/\s+/).filter(Boolean);
    if (!a.length || !b.length) return 0;
    const pairs = common(a, b);
    return pairs ? (2 * pairs.length) / (a.length + b.length) : 0;
  }

  /**
   * Разница двух редакций статьи по абзацам:
   * [{ type: "same", text } | { type: "added", text } | { type: "removed", text } | { type: "changed", parts }],
   * parts — разница по словам (см. words). Похожие абзацы на одном месте считаются изменённым абзацем.
   */
  function paragraphs(before, after) {
    const pairs = common(before, after) || [];
    const result = [];
    let i = 0;
    let j = 0;
    for (const [pi, pj] of [...pairs, [before.length, after.length]]) {
      result.push(...gap(before.slice(i, pi), after.slice(j, pj)));
      if (pi < before.length) result.push({ type: "same", text: before[pi] });
      i = pi + 1;
      j = pj + 1;
    }
    return result;
  }

  /**
   * Абзацы между совпавшими: каждый новый ищет похожий среди прежних по порядку.
   * Как в обычном сравнении текстов, удалённые абзацы идут перед добавленными на их место.
   */
  function gap(removed, added) {
    const result = [];
    let next = 0;
    let pending = [];
    for (const text of added) {
      let match = -1;
      for (let k = next; k < removed.length; k++) {
        if (similarity(removed[k], text) >= SIMILAR) { match = k; break; }
      }
      if (match < 0) {
        pending.push({ type: "added", text });
        continue;
      }
      for (const old of removed.slice(next, match)) result.push({ type: "removed", text: old });
      result.push(...pending, { type: "changed", parts: words(removed[match], text) });
      pending = [];
      next = match + 1;
    }
    for (const old of removed.slice(next)) result.push({ type: "removed", text: old });
    result.push(...pending);
    return result;
  }

  return { words, paragraphs, similarity };
});
