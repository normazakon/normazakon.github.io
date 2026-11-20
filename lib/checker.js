/* Проверка юридических ссылок в тексте. Работает без сервера и без модели.
   Подключается в браузере как window.Checker и в Node как модуль для тестов. */
(function (root, factory) {
  const isNode = typeof module !== "undefined" && module.exports;
  const api = factory(isNode ? require("./editions.js") : root.Editions);
  if (isNode) module.exports = api;
  else root.Checker = api;
})(globalThis, function (Editions) {
  "use strict";

  const SEVERITY = { problem: 2, check: 1, ok: 0 };

  const NUMBER = String.raw`\d+(?:\.\d+)*`;
  const JOINER = String.raw`\s*(?:,|и|по|-|–|—)\s*`;
  const ARTICLE_RE = new RegExp(
    String.raw`(?<!\p{L})(?:ст\.?\s*ст\.?|ст\.|ст(?=\s*\d)|стать\p{L}*|стате\p{L}*)\s*(${NUMBER}(?:${JOINER}${NUMBER})*)`,
    "giu"
  );
  const PART_BEFORE_RE = /(?<!\p{L})(ч\.?|част\p{L}*|п\.?|пункт\p{L}*)\s*(\d+(?:\.\d+)?)[\s,]*$/iu;
  // между номером статьи и названием закона: «статьи 1202 части третьей Гражданского кодекса», «частями первой - третьей»
  const GAP_RE = /^(?:[\s,;]|и|а также|ст\.?|стать\p{L}*|стате\p{L}*|ч\.?|част\p{L}*|п\.?|пункт\p{L}*|пп\.?|подпункт\p{L}*|абз\.?|абзац\p{L}*|(?:перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят)\p{L}*|\d[\d.]*|[-–—])*$/iu;
  const LAW_SEARCH_WINDOW = 200;

  const end = String.raw`(?!\p{L})`;
  const start = String.raw`(?<!\p{L})`;
  const country = String.raw`(?:\s+(?:РФ|России|Российской\s+Федерации))?`;

  /** Федеральный закон по номеру или названию, с необязательными словами «Федеральный закон … от … №» перед ними. */
  function lawByName(names) {
    return new RegExp(`${start}(?:(?:Федеральн\\p{L}+\\s+закон\\p{L}*|Закон\\p{L}*)[^;\\n]{0,50}?)?(?:(?:№|N)\\s*)?(?:${names})[»"]?`, "iu");
  }

  function code(abbr, adjectives) {
    return new RegExp(`${start}(?:${abbr}${country}|${adjectives}\\s+кодекс\\p{L}*${country})${end}`, "iu");
  }

  const LAW_PATTERNS = [
    ["GPK", code("ГПК", String.raw`Гражданск\p{L}+\s+процессуальн\p{L}+`)],
    ["APK", code("АПК", String.raw`Арбитражн\p{L}+\s+процессуальн\p{L}+`)],
    ["GK", code("ГК", String.raw`Гражданск\p{L}+`)],
    ["TK", code("ТК", String.raw`Трудов\p{L}+`)],
    ["JK", code("ЖК", String.raw`Жилищн\p{L}+`)],
    ["SK", code("СК", String.raw`Семейн\p{L}+`)],
    ["NK", code("НК", String.raw`Налогов\p{L}+`)],
    ["KOAP", new RegExp(`${start}(?:КоАП${country}|Кодекс\\p{L}*${country}\\s+об\\s+административных\\s+правонарушениях${country})${end}`, "iu")],
    ["ZOZPP", new RegExp(
      `${start}(?:ЗоЗПП|Закон\\p{L}*[^;\\n]{0,50}?(?:о\\s+защите\\s+прав\\s+потребителей|2300-1)[»"]?)`,
      "iu"
    )],
    ["KONST", new RegExp(`${start}Конституци\\p{L}*${country}${end}`, "iu")],
    ["KAS", new RegExp(`${start}(?:КАС${country}|Кодекс\\p{L}*\\s+административного\\s+судопроизводства${country})${end}`, "iu")],
    ["UPK", code("УПК", String.raw`Уголовно-процессуальн\p{L}+`)],
    ["UK", code("УК", String.raw`Уголовн\p{L}+`)],
    ["ZK", code("ЗК", String.raw`Земельн\p{L}+`)],
    ["FZ229", lawByName(String.raw`229-ФЗ|об\s+исполнительном\s+производстве`)],
    ["FZ127", lawByName(String.raw`127-ФЗ|о\s+несостоятельности\s*\(?банкротстве\)?|о\s+банкротстве`)],
    ["FZ14", lawByName(String.raw`от\s+08\.02\.1998\s*(?:г\.)?\s*(?:№|N)\s*14-ФЗ|об\s+обществах\s+с\s+ограниченной\s+ответственностью|об\s+ООО`)],
    ["FZ208", lawByName(String.raw`208-ФЗ|об\s+акционерных\s+обществах|об\s+АО`)],
    ["FZ218", lawByName(String.raw`218-ФЗ|о\s+государственной\s+регистрации\s+недвижимости`)],
    // перед номером цифр быть не должно: «40-ФЗ» не должен находиться внутри «240-ФЗ»
    ["FZ40", lawByName(String.raw`(?<!\d)40-ФЗ|об\s+ОСАГО|об\s+обязательном\s+страховании\s+гражданской\s+ответственности\s+владельцев\s+транспортных\s+средств`)],
    ["FZ114", lawByName(String.raw`(?<!\d)114-ФЗ|о\s+порядке\s+выезда\s+из\s+Российской\s+Федерации`)],
    ["FZ273", lawByName(String.raw`(?<!\d)273-ФЗ|об\s+образовании\s+в\s+Российской\s+Федерации|(?<=Закон\p{L}*\s)об\s+образовании`)],
    ["FZ323", lawByName(String.raw`(?<!\d)323-ФЗ|об\s+основах\s+охраны\s+здоровья\s+граждан`)],
    ["FZ132", lawByName(String.raw`(?<!\d)132-ФЗ|об\s+основах\s+туристской\s+деятельности`)],
    ["FZ123", lawByName(String.raw`(?<!\d)123-ФЗ|об\s+уполномоченном\s+по\s+правам\s+потребителей\s+финансовых\s+услуг|о\s+финансовом\s+уполномоченном`)],
    ["FZ59", lawByName(String.raw`(?<!\d)59-ФЗ|о\s+порядке\s+рассмотрения\s+обращений\s+граждан`)],
    ["FZ353", lawByName(String.raw`(?<!\d)353-ФЗ|о\s+потребительском\s+кредите(?:\s*\(?займе\)?)?`)],
    ["FZ230", lawByName(String.raw`(?<!\d)230-ФЗ|о\s+защите\s+прав\s+и\s+законных\s+интересов\s+физических\s+лиц\s+при\s+осуществлении\s+деятельности\s+по\s+возврату\s+просроченной\s+задолженности|о\s+коллекторах`)],
    ["PROK", lawByName(String.raw`(?<!\d)2202-[1I]|о\s+прокуратуре\s+Российской\s+Федерации|о\s+прокуратуре`)],
    ["NOTAR", new RegExp(`${start}(?:Основ\\p{L}*\\s+законодательства${country}\\s+о\\s+нотариате|4462-1)`, "iu")],
    ["FZ214", new RegExp(
      `${start}(?:(?:Федеральн\\p{L}+\\s+закон\\p{L}*|Закон\\p{L}*)[^;\\n]{0,50}?)?(?:(?:№|N)\\s*)?(?:214-ФЗ|ФЗ-214|о\\s+долевом\\s+(?:участии|строительстве)|Об\\s+участии\\s+в\\s+долевом\\s+строительстве[^»"\\n]{0,110}[»"]?)`,
      "iu"
    )],
  ];

  const UNKNOWN_LAW_RE = new RegExp(
    String.raw`(?:Федеральн\p{L}+\s+закон\p{L}*|Закон\p{L}*|Указ\p{L}*|Постановлени\p{L}+\s+Правительств\p{L}+|ФЗ|БК\s+РФ|\p{L}+\s+кодекс\p{L}*)` +
    String.raw`(?:\s+(?:РФ|Российской\s+Федерации))?(?:\s+от\s+\d{1,2}\.\d{1,2}\.\d{4})?(?:\s*г\.)?(?:\s*(?:№|N)\s*\d+(?:-\d+)?(?:-ФЗ)?)?(?:\s*[«"][^»"\n]{0,110}[»"])?`,
    "u"
  );

  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const DATE = String.raw`(\d{1,2})\.(\d{1,2})\.(\d{4})|(\d{1,2})\s+(${MONTHS.join("|")})\s+(\d{4})`;
  const PLENUM_RE = new RegExp(
    String.raw`Постановлени\p{L}*\s+Пленума\s+(?:Верховного\s+Суда|ВС|Высшего\s+Арбитражного\s+Суда|ВАС)(?:\s+(?:РФ|Российской\s+Федерации))?\s+от\s+(?:${DATE})(?:\s*(?:г\.|года))?\s*(?:№|N)\s*(\d+)`,
    "giu"
  );
  const ANY_DATE_RE = /(?<![\d.])(\d{2})\.(\d{2})\.(\d{4})(?![\d.]*\d)/g;
  const CASE_RE = /(?:№|N|дел[оау])\s*(\d{1,3}-[А-ЯЁ]{2,3}\d{2}-\d+(?:-[А-ЯЁ]?\d+)*(?:\s*\(\d+\))?)/gu;

  // Только акты, название и реквизиты которых сверены вручную
  const KNOWN_PLENUMS = [
    { date: "2016-03-24", number: "7", title: "О применении судами некоторых положений Гражданского кодекса Российской Федерации об ответственности за нарушение обязательств" },
    { date: "2012-06-28", number: "17", title: "О рассмотрении судами гражданских дел по спорам о защите прав потребителей" },
  ];

  const RULES = [
    {
      id: "ddu-fine",
      applies: (text) => /долев|214-ФЗ|ФЗ-214|ДДУ/iu.test(text),
      find: /штраф\p{L}*[^.\n]{0,90}?(?:50\s*%|пятидесяти\s+процент\p{L}*)|(?:50\s*%|пятидесяти\s+процент\p{L}*)[^.\n]{0,90}?штраф\p{L}*/giu,
      severity: "problem",
      title: "Штраф по ДДУ: возможно, устаревшие 50%",
      message: "Часть 3 статьи 10 214-ФЗ устанавливает штраф 5% от присуждённой суммы. По данным Гаранта, эта редакция действует с 1 сентября 2024 года. Проверьте дату договора и спора: порядок применения к прежним договорам рассматривал Конституционный Суд в постановлении от 14.04.2026 № 24-П.",
      basis: { lawId: "FZ214", number: "10", part: "3" },
    },
    {
      id: "distance-sale",
      applies: (text) => /онлайн|интернет-магазин|маркетплейс|дистанционн|на\s+сайте/iu.test(text),
      find: /(?<!\p{L})ст(?:\.|ать\p{L}*)\s*25\s+(?:ЗоЗПП|Закон\p{L}*[^;\n]{0,50}?(?:защите\s+прав\s+потребителей|2300-1)[»"]?)/giu,
      severity: "check",
      title: "Покупка онлайн: нужна статья 26.1",
      message: "Статья 25 описывает обмен товара при обычной покупке. При дистанционной продаже отказ от товара регулирует статья 26.1 Закона о защите прав потребителей. Проверьте, какая норма подходит к делу.",
      basis: { lawId: "ZOZPP", number: "26.1" },
    },
    {
      id: "consumer-venue",
      applies: (text) => /потребител|гражданин|физическ\p{L}+\s+лиц/iu.test(text),
      find: /спор\p{L}*[^.\n]{0,80}?по\s+месту\s+нахождения\s+(?:исполнителя|подрядчика|продавца|ответчика)/giu,
      severity: "check",
      title: "Подсудность в договоре с потребителем",
      message: "Потребитель вправе выбрать суд по пункту 2 статьи 17 Закона о защите прав потребителей. Условие, которое ограничивает этот выбор, может оказаться недопустимым по статье 16. Проверьте, является ли гражданин потребителем в этом договоре.",
      basis: { lawId: "ZOZPP", number: "17", part: "2" },
    },
  ];

  function isRealDate(day, month, year) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /** Превращает «309, 310 и 1153-1155» в список номеров, раскрывая диапазоны. */
  function expandNumbers(list) {
    const tokens = list.match(/\d+(?:\.\d+)*|по|-|–|—/g) || [];
    const numbers = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!/^\d/.test(token)) continue;
      const isRange = /^(?:по|-|–|—)$/.test(tokens[i + 1] || "") && /^\d/.test(tokens[i + 2] || "");
      if (!isRange) { numbers.push(token); continue; }
      const last = tokens[i + 2];
      const from = Number(token);
      const to = Number(last);
      if (/^\d+$/.test(token) && /^\d+$/.test(last) && to > from && to - from <= 30) {
        for (let n = from; n <= to; n++) numbers.push(String(n));
      } else {
        numbers.push(token, last);
      }
      i += 2;
    }
    return numbers;
  }

  /** Ищет закон сразу за номерами статей. Между ними допустимы только другие ссылки. */
  function findLaw(text, from) {
    const windowText = text.slice(from, from + LAW_SEARCH_WINDOW);
    let best = null;
    for (const [lawId, pattern] of LAW_PATTERNS) {
      const match = pattern.exec(windowText);
      if (match && (!best || match.index < best.index)) {
        best = { lawId, index: match.index, length: match[0].length };
      }
    }
    const unknown = UNKNOWN_LAW_RE.exec(windowText);
    if (unknown && (!best || unknown.index < best.index)) {
      best = { lawId: null, index: unknown.index, length: unknown[0].length, name: unknown[0].replace(/\s+/g, " ").trim() };
    }
    if (!best || !GAP_RE.test(windowText.slice(0, best.index))) return null;
    return { ...best, end: from + best.index + best.length };
  }

  function nearestArticles(law, number) {
    const value = Number.parseFloat(number);
    const base = number.split(".")[0];
    return Object.keys(law.articles)
      // преамбула и другие части без номера ближайшей статьёй не предлагаются
      .filter((n) => !law.articles[n].repealed && /^\d/.test(n))
      .sort((a, b) => {
        const sameBase = (n) => (n.split(".")[0] === base ? 0 : 1);
        return sameBase(a) - sameBase(b) || Math.abs(Number.parseFloat(a) - value) - Math.abs(Number.parseFloat(b) - value);
      })
      .slice(0, 2);
  }

  /** Пометка о редакции для сообщения: на какую дату сверено. */
  function editionNote(found, date) {
    const day = Editions.formatDate(date);
    if (found.status === "unknown") {
      return ` Редакции этой статьи в базе начинаются с ${Editions.formatDate(found.since)}, поэтому статья сверена с самой ранней известной редакцией, а не с той, что действовала ${day}.`;
    }
    return found.version.current ? ` На ${day} действовала нынешняя редакция.` : ` Сверено с редакцией, которая действовала ${day}.`;
  }

  /**
   * Проверка статьи по редакции на дату документа. Нужны options.date и загруженные options.editions этого закона.
   * Возвращает null, если сверять по дате нечем: тогда проверяется действующая редакция.
   */
  function checkArticleAt(base, lawId, number, part, partWord, options) {
    const { date, editions, texts } = options;
    const law = base.laws[lawId];
    if (!date || !editions || !editions[lawId] || !law.articles[number]) return null;
    const found = Editions.at(base, editions, texts || null, lawId, number, date);
    const article = law.articles[number];
    const label = `${part ? `${partWord} ${part} ` : ""}ст. ${number} ${law.short}`;
    const common = {
      kind: "article", lawId, number, part: part || null, label, url: article.url, date,
      hasText: Boolean(article.hasText), editionFrom: found.version ? found.version.from : null,
    };
    const day = Editions.formatDate(date);
    if (found.status === "absent") {
      return {
        ...common, title: article.title, severity: "problem", status: "Ещё не было",
        message: `На ${day} статьи ${number} ${law.short} ещё не было: она появилась ${Editions.formatDate(found.since)}.`,
      };
    }
    const version = found.version;
    const result = { ...common, title: version.title };
    if (version.repealed) {
      const revived = found.status === "version" && found.versions.find((item) => item.from > date && !item.repealed);
      return {
        ...result, severity: "problem", status: "Утратила силу",
        message: revived ? `${version.title}. Снова действует с ${Editions.formatDate(revived.from)}.` : version.title,
      };
    }
    if (part && version.parts.length && !version.parts.includes(part)) {
      return {
        ...result, severity: "problem", status: "Нет такой части",
        message: `В редакции на ${day} части статьи ${number} ${law.short} идут так: ${version.parts.join(", ")}. Пункта или части ${part} там нет.`,
      };
    }
    return {
      ...result, severity: found.status === "unknown" ? "check" : "ok",
      status: found.status === "unknown" ? "Редакция неизвестна" : "Найдена",
      message: "Статья есть в базе. Подтверждает ли она довод, проверьте по тексту нормы." + editionNote(found, date),
    };
  }

  function checkArticle(base, lawId, number, part, partWord, options = {}) {
    const dated = checkArticleAt(base, lawId, number, part, partWord, options);
    if (dated) return dated;
    const law = base.laws[lawId];
    const article = law.articles[number];
    const label = `${part ? `${partWord} ${part} ` : ""}ст. ${number} ${law.short}`;
    const finding = { kind: "article", lawId, number, part: part || null, label };

    if (!article) {
      const near = nearestArticles(law, number).map((n) => `${n}: ${law.articles[n].title}`);
      return {
        ...finding,
        severity: "problem",
        status: "Статьи нет",
        message: `В текущем оглавлении ${law.short} статьи ${number} нет. Если она существовала раньше, значит, сейчас не действует.`,
        suggestions: near,
      };
    }
    const common = { ...finding, title: article.title, url: article.url, hasText: Boolean(article.hasText) };
    if (article.repealed) {
      return { ...common, severity: "problem", status: "Утратила силу", message: article.title };
    }
    if (part && article.parts && article.parts.length && !article.parts.includes(part)) {
      return {
        ...common,
        severity: "problem",
        status: "Нет такой части",
        message: `В статье ${number} ${law.short} части идут так: ${article.parts.join(", ")}. Пункта или части ${part} там нет.`,
      };
    }
    return {
      ...common,
      severity: "ok",
      status: "Найдена",
      message: article.hasText
        ? "Статья есть в базе. Подтверждает ли она довод, проверьте по тексту нормы."
        : "Статья есть в оглавлении. Текста этой нормы пока нет в демо-базе.",
    };
  }

  function findArticles(text, base, options) {
    const findings = [];
    for (const match of text.matchAll(ARTICLE_RE)) {
      const numbersEnd = match.index + match[0].length;
      let law = findLaw(text, numbersEnd);
      if (!law) continue;
      // закон узнан, но в этой сборке базы его нет: проверяем его как неизвестный
      if (law.lawId && !base.laws[law.lawId]) law = { ...law, lawId: null, name: text.slice(law.end - law.length, law.end).replace(/\s+/g, " ").trim() };

      const before = text.slice(Math.max(0, match.index - 30), match.index);
      const partMatch = PART_BEFORE_RE.exec(before);
      const part = partMatch ? partMatch[2] : null;
      const partWord = partMatch && /^ч/i.test(partMatch[1]) ? "ч." : "п.";
      const rangeStart = partMatch ? match.index - (before.length - partMatch.index) : match.index;
      const range = { start: rangeStart, end: law.end };
      const numbers = expandNumbers(match[1]);

      if (!law.lawId) {
        findings.push({
          ...range,
          kind: "article",
          severity: "check",
          status: "Закона нет в базе",
          label: `ст. ${numbers.join(", ")}: ${law.name}`,
          message: "Этого акта пока нет в демо-базе, поэтому ссылка не проверена.",
        });
        continue;
      }
      numbers.forEach((number, index) => {
        findings.push({ ...range, ...checkArticle(base, law.lawId, number, index === 0 ? part : null, partWord, options) });
      });
    }
    return findings;
  }

  function findPlenums(text) {
    const findings = [];
    for (const match of text.matchAll(PLENUM_RE)) {
      const [quote, d1, m1, y1, d2, monthName, y2, number] = match;
      const day = Number(d1 || d2);
      const month = m1 ? Number(m1) : MONTHS.indexOf(monthName.toLowerCase()) + 1;
      const year = Number(y1 || y2);
      const range = { start: match.index, end: match.index + quote.length };
      const label = `Постановление Пленума № ${number}`;

      if (!isRealDate(day, month, year)) {
        findings.push({
          ...range, kind: "act", severity: "problem", status: "Невозможная дата", label,
          message: `Даты ${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year} не существует. Такого постановления быть не может.`,
        });
        continue;
      }
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const known = KNOWN_PLENUMS.find((act) => act.date === iso && act.number === number);
      findings.push(known
        ? { ...range, kind: "act", severity: "ok", status: "Найдено", label, title: known.title, message: "Реквизиты совпадают со списком сверенных постановлений. Пункт и смысл разъяснения проверьте по тексту." }
        : { ...range, kind: "act", severity: "check", status: "Не проверено", label, message: "Этого постановления нет в демо-базе. Реквизиты нужно проверить вручную." });
    }
    return findings;
  }

  function findBadDates(text, taken) {
    const findings = [];
    for (const match of text.matchAll(ANY_DATE_RE)) {
      const inside = taken.some((f) => match.index >= f.start && match.index < f.end);
      if (inside || isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))) continue;
      findings.push({
        start: match.index, end: match.index + match[0].length, kind: "date",
        severity: "problem", status: "Невозможная дата", label: match[0],
        message: "Такой календарной даты нет. Проверьте реквизиты документа.",
      });
    }
    return findings;
  }

  function findCases(text) {
    return [...text.matchAll(CASE_RE)].map((match) => ({
      start: match.index, end: match.index + match[0].length, kind: "case",
      severity: "check", status: "Не проверено", label: `Дело № ${match[1]}`,
      message: "Формат номера похож на дело Верховного Суда. Судебную практику демо не проверяет, откройте акт и сверьте вывод.",
    }));
  }

  function findRules(text, base) {
    const findings = [];
    for (const rule of RULES) {
      if (!rule.applies(text)) continue;
      for (const match of text.matchAll(rule.find)) {
        const article = base.laws[rule.basis.lawId].articles[rule.basis.number];
        findings.push({
          start: match.index, end: match.index + match[0].length, kind: "rule", ruleId: rule.id,
          severity: rule.severity, status: "Спецнорма", label: rule.title, message: rule.message,
          lawId: rule.basis.lawId, number: rule.basis.number, part: rule.basis.part || null,
          title: article && article.title, url: article && article.url,
          hasText: Boolean(article && article.hasText),
        });
      }
    }
    return findings;
  }

  /**
   * Проверяет ссылки в тексте.
   * options.date: дата документа ГГГГ-ММ-ДД, тогда статьи сверяются с редакцией на эту дату;
   * options.editions: загруженные редакции законов (window.LAW_EDITIONS);
   * options.texts: загруженные тексты (window.LAW_TEXTS), без них части прежних редакций не сверяются.
   */
  function analyze(text, base, options = {}) {
    const articles = findArticles(text, base, options);
    const plenums = findPlenums(text);
    const findings = [
      ...articles, ...plenums, ...findBadDates(text, plenums), ...findCases(text), ...findRules(text, base),
    ]
      .sort((a, b) => a.start - b.start || SEVERITY[b.severity] - SEVERITY[a.severity])
      .map((finding, index) => ({ ...finding, id: index }));

    const counts = { problem: 0, check: 0, ok: 0 };
    for (const finding of findings) counts[finding.severity]++;
    return { findings, counts };
  }

  // «… статьей 395 настоящего Кодекса»: ссылка на тот же закон, в котором стоит текст
  const CURRENT_LAW_RE = /^(?:[\s,;]|и|а также|ч\.?|част\p{L}*|п\.?|пункт\p{L}*|пп\.?|подпункт\p{L}*|абз\.?|абзац\p{L}*|\d[\d.]*|[-–—])*настоящ\p{L}+\s+(?:Кодекс\p{L}*|Федеральн\p{L}+\s+закон\p{L}*|Закон\p{L}*|Основ\p{L}*|Конституци\p{L}*)/iu;
  const NUMBER_RE = /\d+(?:\.\d+)*/g;

  /**
   * Ссылки на статьи внутри текста нормы, по которым можно перейти.
   * lawId: закон, в котором стоит текст, для оборотов «настоящего Кодекса».
   * Отдаёт [{ start, end, lawId, number }] только для статей, которые есть в базе.
   */
  function findReferences(text, lawId, base) {
    const references = [];
    for (const match of text.matchAll(ARTICLE_RE)) {
      const numbersEnd = match.index + match[0].length;
      let target = null;
      if (CURRENT_LAW_RE.test(text.slice(numbersEnd, numbersEnd + 160))) {
        target = lawId;
      } else {
        const law = findLaw(text, numbersEnd);
        if (law && law.lawId) target = law.lawId;
      }
      const articles = target && base.laws[target] && base.laws[target].articles;
      if (!articles) continue;
      const numbersStart = numbersEnd - match[1].length;
      let first = true;
      for (const number of match[1].matchAll(NUMBER_RE)) {
        if (!articles[number[0]]) continue;
        // первое число ссылки берём вместе со словом «статьей», остальные отдельно
        const start = first ? match.index : numbersStart + number.index;
        references.push({ start, end: numbersStart + number.index + number[0].length, lawId: target, number: number[0] });
        first = false;
      }
    }
    return references;
  }

  /** Отдаёт абзацы процитированной части статьи или всю статью, если часть не определена. */
  function paragraphsOfPart(paragraphs, part) {
    if (!paragraphs) return [];
    if (!part) return paragraphs;
    const number = (line) => (/^(\d+(?:\.\d+)?)\.\s/.exec(line) || [])[1];
    const first = paragraphs.findIndex((line) => number(line) === part);
    if (first < 0) return paragraphs;
    const next = paragraphs.findIndex((line, index) => index > first && number(line));
    return paragraphs.slice(first, next < 0 ? undefined : next);
  }

  return { analyze, expandNumbers, paragraphsOfPart, findReferences, SEVERITY };
});
