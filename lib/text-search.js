/* Поиск по словам в текстах статей. Работает целиком в браузере по уже загруженным текстам.
   Окончания слов отбрасываются грубо, без словаря: «неустойку» найдёт «неустойка» и «неустойки». */
(function (root) {
  "use strict";

  const ENDINGS = [
    "иями", "ями", "ами", "ией", "иях", "ого", "его", "ому", "ему", "ыми", "ими", "ых", "их",
    "ой", "ей", "ий", "ый", "ая", "яя", "ое", "ее", "ые", "ие", "ую", "юю", "ом", "ем", "ам", "ям", "ах", "ях",
    "ов", "ев", "ия", "ию", "ии", "ть", "а", "я", "о", "е", "ы", "и", "у", "ю", "ь", "й",
  ];
  const MIN_STEM = 4;
  const LETTER = "0-9a-zа-я";
  const MAX_RESULTS = 500;
  const SNIPPET_RADIUS = 90;
  const TEXT_HITS_CAP = 5;
  const PHRASE_BONUS = 15;

  function normalize(text) {
    return text.toLowerCase().replace(/ё/g, "е");
  }

  /** Основа слова: отбрасывает одно окончание, если остаётся не меньше четырёх букв. */
  function stem(word) {
    for (const ending of ENDINGS) {
      if (word.endsWith(ending) && word.length - ending.length >= MIN_STEM) return word.slice(0, -ending.length);
    }
    return word;
  }

  /** Слова запроса, по которым ищем. Короткие служебные слова пропускаются. */
  function queryTerms(query) {
    const words = normalize(query).match(new RegExp(`[${LETTER}]+`, "g")) || [];
    const terms = [];
    for (const word of words) {
      if (word.length < 3 && !/^\d+$/.test(word)) continue;
      const term = stem(word);
      if (!terms.includes(term)) terms.push(term);
    }
    return terms;
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** Регулярное выражение, которое находит слово, начинающееся с основы. */
  function termPattern(term) {
    return new RegExp(`(^|[^${LETTER}])(${escapeRegExp(term)}[${LETTER}]*)`, "g");
  }

  /** Слова запроса подряд и в том же порядке, между ними только пробелы и знаки препинания. */
  function phrasePattern(terms) {
    const words = terms.map((term) => `${escapeRegExp(term)}[${LETTER}]*`).join(`[^${LETTER}]{1,3}`);
    return new RegExp(`(^|[^${LETTER}])(${words})`, "g");
  }

  /** Отрывок вокруг первого совпадения: { before, match, after }. Текст исходный, регистр сохраняется. */
  function snippet(text, normalized, pattern) {
    pattern.lastIndex = 0;
    const found = pattern.exec(normalized);
    if (!found) return null;
    const start = found.index + found[1].length;
    const end = start + found[2].length;
    let from = Math.max(0, start - SNIPPET_RADIUS);
    let to = Math.min(text.length, end + SNIPPET_RADIUS);
    if (from > 0) from = text.indexOf(" ", from) + 1 || from;
    if (to < text.length) to = text.lastIndexOf(" ", to) > end ? text.lastIndexOf(" ", to) : to;
    return {
      before: (from > 0 ? "…" : "") + text.slice(from, start),
      match: text.slice(start, end),
      after: text.slice(end, to) + (to < text.length ? "…" : ""),
    };
  }

  function countMatches(normalized, pattern) {
    pattern.lastIndex = 0;
    let count = 0;
    while (pattern.exec(normalized)) count++;
    return count;
  }

  const prepared = new WeakMap();

  /** Склеенный текст статьи и его нижний регистр. Считается один раз на массив абзацев. */
  function prepare(paragraphs) {
    let entry = prepared.get(paragraphs);
    if (!entry) {
      const text = paragraphs.join(" ");
      entry = { text, normalized: normalize(text) };
      prepared.set(paragraphs, entry);
    }
    return entry;
  }

  /**
   * Ищет статьи, где встречаются все слова запроса.
   * sources: [{ lawId, articles: { номер: { title } }, texts: { номер: [абзацы] } }]
   * Возвращает { matches: [{ lawId, number, score, snippet }], total, terms }.
   */
  function search(sources, query, limit = MAX_RESULTS) {
    const terms = queryTerms(query);
    if (!terms.length) return { matches: [], total: 0, terms };
    const patterns = terms.map(termPattern);
    const phrase = terms.length > 1 ? phrasePattern(terms) : null;
    const matches = [];
    for (const { lawId, articles, texts } of sources) {
      for (const [number, paragraphs] of Object.entries(texts)) {
        const article = articles[number];
        if (!article || !Array.isArray(paragraphs)) continue;
        const { text, normalized } = prepare(paragraphs);
        const title = normalize(article.title);
        let score = 0;
        let everyTerm = true;
        for (const pattern of patterns) {
          const inTitle = countMatches(title, pattern);
          const inText = countMatches(normalized, pattern);
          if (!inTitle && !inText) { everyTerm = false; break; }
          // повторы в тексте учитываем немного, иначе длинные статьи всегда оказываются выше
          score += inTitle * 10 + Math.min(inText, TEXT_HITS_CAP);
        }
        if (!everyTerm) continue;
        const phrases = phrase ? countMatches(normalized, phrase) + countMatches(title, phrase) : 0;
        score += Math.min(phrases, 3) * PHRASE_BONUS;
        matches.push({ lawId, number, score, snippet: snippet(text, normalized, phrases ? phrase : patterns[0]) });
      }
    }
    matches.sort((a, b) => b.score - a.score);
    return { matches: matches.slice(0, limit), total: matches.length, terms };
  }

  /** Части строки для подсветки: [{ text, hit }]. */
  function highlight(text, terms) {
    if (!terms.length) return [{ text, hit: false }];
    const pattern = new RegExp(`(^|[^${LETTER}])((?:${terms.map(escapeRegExp).join("|")})[${LETTER}]*)`, "g");
    const normalized = normalize(text);
    const parts = [];
    let last = 0;
    let found;
    while ((found = pattern.exec(normalized))) {
      const start = found.index + found[1].length;
      const end = start + found[2].length;
      if (start > last) parts.push({ text: text.slice(last, start), hit: false });
      parts.push({ text: text.slice(start, end), hit: true });
      last = end;
    }
    if (last < text.length) parts.push({ text: text.slice(last), hit: false });
    return parts;
  }

  root.TextSearch = { search, queryTerms, stem, highlight, normalize };
})(typeof window !== "undefined" ? window : globalThis);
