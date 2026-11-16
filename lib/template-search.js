/* Поиск и виды документов в каталоге шаблонов. Работает по уже загруженным шаблонам, без сети.
   Ищет по названию, описанию, разделу, статьям закона (название закона и номер) и примечаниям. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TemplateSearch = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /** Виды документов по названию: порядок важен, берётся первый подходящий. */
  const KINDS = [
    ["Иски", /(^|\s)иск(овое|\s|$)|иск о|иск об/],
    ["Жалобы", /жалоб/],
    ["Ходатайства", /ходатайств/],
    ["Претензии и требования", /претензи|требовани/],
    ["Доверенности", /доверенност/],
    ["Приказы", /приказ/],
    ["Акты", /(^|\s)акт(\s|$)/],
    ["Расписки", /расписк/],
    ["Уведомления", /уведомлен/],
    ["Заявления", /заявлени/],
    ["Решения и протоколы", /решени|протокол/],
    ["Договоры и соглашения", /договор|соглашени/],
  ];
  const OTHER = "Другие";
  const KIND_ORDER = [...KINDS.map(([name]) => name), OTHER];

  /** Слова, которые только вводят номер статьи или связывают слова: по ним не ищем. */
  const STOP_WORDS = new Set(["ст", "статья", "статьи", "статье", "статью", "для", "при", "про", "что", "как", "или"]);

  const normalize = (text) => String(text || "").toLowerCase().replace(/ё/g, "е");

  function kindOf(template) {
    const title = normalize(template.title);
    const found = KINDS.find(([, pattern]) => pattern.test(title));
    return found ? found[0] : OTHER;
  }

  /** Есть ли в тексте слово, начинающееся с основы part. */
  function hasWord(text, part) {
    let from = 0;
    for (;;) {
      const index = text.indexOf(part, from);
      if (index < 0) return false;
      if (index === 0 || !/[a-zа-я0-9]/.test(text[index - 1])) return true;
      from = index + 1;
    }
  }

  /** Подпись статей, на которых построен шаблон: «Гражданский кодекс ГК 395». */
  function basisText(template, laws) {
    return (template.basis || []).map(({ lawId, number }) => {
      const law = laws && laws[lawId];
      return `${law ? `${law.short} ${law.name}` : lawId} ${number}`;
    }).join(" ");
  }

  /**
   * Подбирает шаблоны под запрос. Каждое слово запроса должно встретиться (с любым окончанием);
   * если так ничего не нашлось, достаточно большинства слов.
   * Возвращает шаблоны по убыванию совпадения: название важнее описания, описание важнее примечаний.
   */
  function rank(templates, query, { stem, laws }) {
    const words = (normalize(query).match(/[а-яa-z0-9]+(?:\.[0-9]+)?/g) || [])
      .filter((word) => (word.length >= 2 || /^\d+$/.test(word)) && !STOP_WORDS.has(word));
    if (!words.length) return templates.slice();
    const stems = words.map((word) => (/^[\d.]+$/.test(word) ? word : stem(word)));
    const scored = templates.map((template) => {
      const title = normalize(template.title);
      const summary = normalize(`${template.summary} ${template.category}`);
      const basis = normalize(basisText(template, laws));
      const notes = normalize((template.notes || []).join(" "));
      let hits = 0;
      let score = 0;
      for (const part of stems) {
        const inTitle = hasWord(title, part);
        const inSummary = hasWord(summary, part);
        const inBasis = hasWord(basis, part);
        const inNotes = hasWord(notes, part);
        if (inTitle || inSummary || inBasis || inNotes) hits += 1;
        score += (inTitle ? 6 : 0) + (inSummary ? 3 : 0) + (inBasis ? 2 : 0) + (inNotes ? 1 : 0);
      }
      if (title.includes(normalize(query).trim())) score += 10;
      return { template, hits, score };
    });
    let found = scored.filter((entry) => entry.hits === stems.length);
    if (!found.length && stems.length > 1) found = scored.filter((entry) => entry.hits >= Math.ceil(stems.length / 2));
    return found.sort((a, b) => b.score - a.score).map((entry) => entry.template);
  }

  return { rank, kindOf, KIND_ORDER, hasWord, basisText };
});
