/* Редакции статей: какой текст действовал на нужную дату.
   Прежние редакции лежат по файлу на закон в data/editions/ и загружаются, только когда нужны.
   Подключается в браузере как window.Editions и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Editions = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PART_RE = /^(\d+(?:\.\d+)?)\.\s/;
  // слово или пробелы между словами, как TOKEN_RE в tools/build_laws.py
  const TOKEN_RE = /\S+|\s+/g;

  function partsOf(paragraphs) {
    return (paragraphs || []).map((line) => PART_RE.exec(line)).filter(Boolean).map((match) => match[1]);
  }

  /** День до даты в формате ГГГГ-ММ-ДД: последняя дата действия прежней редакции. */
  function dayBefore(iso) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  /**
   * Восстанавливает текст версии. В файле он записан целиком (text) или разницей с соседней версией (delta):
   * строки — новые абзацы, пары [начало, конец] — абзацы соседней версии,
   * { p, w } — абзац соседней версии с номером p, изменённый по словам. Без соседнего текста отдаёт null.
   */
  function unpack(version, reference) {
    if (version.repealed) return [];
    if (version.text) return version.text;
    if (!version.delta) return [];
    if (!reference) return null;
    return version.delta.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (Array.isArray(item)) return reference.slice(item[0], item[1]);
      // абзац, изменённый по словам: пары — слова прежнего абзаца, строки — новый текст
      const words = reference[item.p].match(TOKEN_RE) || [];
      return [item.w.map((part) => (typeof part === "string" ? part : words.slice(part[0], part[1]).join(""))).join("")];
    });
  }

  /**
   * Все известные редакции статьи по возрастанию даты.
   * Каждая: { from, to, title, text, parts, repealed, current, future }. to у последней равно null.
   * future: принятая редакция, которая ещё не вступила в силу.
   * Тексты прежних редакций записаны разницей с действующей, поэтому без загруженных текстов закона
   * text у действующей и у записанных разницей версий равен null, а parts берутся из оглавления.
   */
  function history(base, editions, texts, lawId, number) {
    const law = base.laws[lawId];
    const article = law && law.articles[number];
    if (!article) return [];
    const lawEditions = editions && editions[lawId];
    const record = (lawEditions && lawEditions.articles[number]) || {};
    const since = record.since || (lawEditions && lawEditions.since) || law.since;
    const currentText = article.repealed ? [] : (texts && texts[lawId] && texts[lawId][number]) || null;
    const make = (version, text, kind) => ({
      from: version.from,
      title: version.title,
      text,
      parts: text ? partsOf(text) : [],
      repealed: Boolean(version.repealed),
      current: kind === "current",
      future: kind === "future",
    });

    // прежние версии восстанавливаются от действующей назад
    const old = [];
    let reference = currentText;
    for (const version of [...(record.old || [])].reverse()) {
      const text = unpack(version, reference);
      old.unshift(make(version, text, "old"));
      reference = text;
    }
    const current = make({ from: record.current || record.added || since, title: article.title, repealed: article.repealed }, currentText, "current");
    current.parts = article.parts || [];
    // будущие версии восстанавливаются от действующей вперёд
    const future = [];
    reference = currentText;
    for (const version of record.future || []) {
      const text = unpack(version, reference);
      future.push(make(version, text, "future"));
      reference = text;
    }
    const versions = [...old, current, ...future];
    versions.forEach((version, index) => {
      version.to = index + 1 < versions.length ? dayBefore(versions[index + 1].from) : null;
    });
    return versions;
  }

  /**
   * Редакция статьи на дату.
   * status: "version"  нашлась редакция, которая действовала в этот день;
   *         "absent"   статьи в этот день ещё не было;
   *         "unknown"  дата раньше начала истории на портале, отдаём самую раннюю известную редакцию.
   */
  function at(base, editions, texts, lawId, number, date) {
    const versions = history(base, editions, texts, lawId, number);
    if (!versions.length) return { status: "absent", version: null, versions };
    const lawEditions = editions && editions[lawId];
    const record = (lawEditions && lawEditions.articles[number]) || {};
    const since = record.since || (lawEditions && lawEditions.since) || base.laws[lawId].since;
    if (record.added && date < record.added) return { status: "absent", version: null, versions, since: record.added };
    if (date < since) return { status: "unknown", version: versions[0], versions, since };
    const version = [...versions].reverse().find((item) => item.from <= date) || versions[0];
    return { status: "version", version, versions, since };
  }

  /** Дата для людей: 2023-03-11 → 11.03.2023. */
  function formatDate(iso) {
    return iso ? iso.split("-").reverse().join(".") : "";
  }

  /** Подпись редакции в списке: «с 01.09.2025 по 22.10.2026», «с 23.10.2026, действующая», «с 01.01.2027, ещё не вступила в силу». */
  function label(version) {
    if (version.current) return `с ${formatDate(version.from)}, действующая`;
    if (version.future) return `с ${formatDate(version.from)}, ещё не вступила в силу`;
    return `с ${formatDate(version.from)} по ${formatDate(version.to)}`;
  }

  /* ---------- загрузка файлов в браузере ---------- */

  const pending = new Map();

  function store() {
    if (typeof window === "undefined") return {};
    window.LAW_EDITIONS = window.LAW_EDITIONS || {};
    return window.LAW_EDITIONS;
  }

  function isLoaded(lawId) {
    return Boolean(store()[lawId]);
  }

  function load(lawId) {
    if (isLoaded(lawId)) return Promise.resolve(store()[lawId]);
    if (pending.has(lawId)) return pending.get(lawId);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `data/editions/${encodeURIComponent(lawId)}.js`;
      script.onload = () => (isLoaded(lawId) ? resolve(store()[lawId]) : reject(new Error("Файл редакций пуст")));
      script.onerror = () => {
        pending.delete(lawId);
        reject(new Error("Не удалось загрузить редакции"));
      };
      document.head.append(script);
    });
    pending.set(lawId, promise);
    return promise;
  }

  return { history, at, label, formatDate, dayBefore, partsOf, unpack, load, isLoaded };
});
