/* Общий поиск с главной: статья по номеру («395 ГК»), статьи по заголовку, шаблоны и расчёты.
   Подключается в браузере как window.SiteSearch и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SiteSearch = api;
})(globalThis, function () {
  "use strict";

  // как закон называют в запросе: «гк», «гпк рф», «закон об ооо», «127-фз»
  const ALIASES = {
    GK: ["гк", "гражданский кодекс"], GPK: ["гпк"], APK: ["апк"], KAS: ["кас"], TK: ["тк", "трудовой кодекс"],
    JK: ["жк", "жилищный кодекс"], SK: ["ск", "семейный кодекс"], ZK: ["зк", "земельный кодекс"], KOAP: ["коап"],
    NK: ["нк", "налоговый кодекс"], UK: ["ук", "уголовный кодекс"], UPK: ["упк"],
    ZOZPP: ["зозпп", "зпп", "о защите прав потребителей"], FZ214: ["214-фз", "214 фз", "фз-214"],
    FZ229: ["229-фз", "229 фз", "об исполнительном производстве"], FZ127: ["127-фз", "127 фз", "о банкротстве"],
    FZ14: ["14-фз", "об ооо", "закон об ооо"], FZ208: ["208-фз", "об ао", "закон об ао"],
    FZ218: ["218-фз", "о регистрации недвижимости"], NOTAR: ["о нотариате", "нотариат"],
  };

  // расчёты и разделы по словам запроса (основы слов, без окончаний)
  const TOOLS = [
    { stems: ["срок", "апелляц", "кассац", "обжалов", "жалоб", "истека"], title: "Калькулятор процессуальных сроков", text: "Последний день срока по ГПК, АПК, ГК, ТК и КоАП", link: "#calc/deadline" },
    { stems: ["пошлин", "госпошлин"], title: "Государственная пошлина", text: "По цене иска для суда общей юрисдикции и арбитража", link: "#calc/fee" },
    { stems: ["процент", "ключев", "просрочк", "395"], title: "Проценты по статье 395 ГК РФ", text: "По ключевой ставке Банка России", link: "#calc/interest" },
    { stems: ["неустойк", "пени", "пеня"], title: "Неустойка", text: "Договорная или законная, с пределом", link: "#calc/penalty" },
    { stems: ["провер", "ссылк", "ошибк", "сверить"], title: "Проверка документа", text: "Найдём ошибки в ссылках на статьи законов", link: "#check" },
  ];

  const NUMBER_RE = /(?:^|[^\d.])(\d+(?:\.\d+)*(?:-\d+)*)(?![\d.])/;

  // бытовые слова, которых нет в названиях: «развод» ищет «брак», «уволиться» ищет «увольнение»
  const SYNONYMS = {
    развод: ["брак"], уволи: ["увольн"], увол: ["увольн"], расторг: ["расторж"],
    займ: ["заем"], долг: ["заем", "займ"], квартир: ["жил"], машин: ["автомобил"], авто: ["автомобил"],
    работодател: ["трудов"], работник: ["трудов"], зарплат: ["заработн"],
    вернуть: ["возврат"], магазин: ["товар", "продав"], деньг: ["возврат", "оплат"],
  };

  function normalize(text) {
    return text.toLowerCase().replace(/ё/g, "е").replace(/[«»"]/g, " ").replace(/\s+/g, " ").trim();
  }

  /** Варианты основы: сама основа и синонимы, если основа начинается с известного слова. */
  function variants(stem) {
    const extra = Object.entries(SYNONYMS).filter(([key]) => stem.startsWith(key)).flatMap(([, list]) => list);
    return [stem, ...extra];
  }

  /** Есть ли в тексте слово, которое начинается с основы или её синонима, а не просто содержит её внутри: «иск» не находит «расписку». */
  function hasWord(text, stem) {
    return variants(stem).some((variant) => new RegExp(`(^|[^а-яa-z0-9])${variant}`).test(text));
  }

  /** Закон, названный в запросе, и остаток запроса без его названия. */
  function findLaw(query) {
    let best = null;
    for (const [lawId, aliases] of Object.entries(ALIASES)) {
      for (const alias of aliases) {
        const pattern = new RegExp(`(^|[^а-я0-9])${alias.replace(/[-.]/g, "\\$&")}( рф)?(?=$|[^а-я0-9])`);
        const match = pattern.exec(query);
        if (match && (!best || alias.length > best.alias.length)) best = { lawId, alias, rest: (query.slice(0, match.index) + " " + query.slice(match.index + match[0].length)).trim() };
      }
    }
    return best;
  }

  /**
   * Ищет по запросу. stem: функция, которая отбрасывает окончание слова (TextSearch.stem).
   * Отдаёт { articles, templates, tools }: в articles сначала статья, названная номером, потом совпадения по заголовку.
   */
  function search(query, { base, templates, stem }) {
    const normalized = normalize(query);
    const result = { articles: [], templates: [], tools: [] };
    if (normalized.length < 2) return result;
    const laws = base.laws;
    const seen = new Set();
    const addArticle = (lawId, number) => {
      const key = `${lawId}:${number}`;
      if (seen.has(key) || !laws[lawId] || !laws[lawId].articles[number]) return;
      seen.add(key);
      result.articles.push({ lawId, number, title: laws[lawId].articles[number].title, short: laws[lawId].short });
    };

    const law = findLaw(normalized);
    const withoutLaw = law ? law.rest : normalized;
    const numberMatch = NUMBER_RE.exec(withoutLaw.replace(/^(ст\.?|статья|статьи)\s*/, ""));
    if (numberMatch) {
      const number = numberMatch[1];
      if (law) addArticle(law.lawId, number);
      // номер без закона: статья с таким номером в каждом законе, где она есть
      else Object.keys(laws).forEach((lawId) => addArticle(lawId, number));
    }

    const words = withoutLaw.replace(NUMBER_RE, " ").split(/[^а-яa-z0-9]+/).filter((word) => word.length >= 3 && !["ст", "статья", "статьи"].includes(word));
    const stems = words.map(stem);
    if (stems.length) {
      const lawIds = law ? [law.lawId] : Object.keys(laws);
      outer: for (const lawId of lawIds) {
        for (const [number, article] of Object.entries(laws[lawId].articles)) {
          if (article.repealed) continue;
          const title = normalize(article.title);
          if (stems.every((part) => hasWord(title, part))) addArticle(lawId, number);
          if (result.articles.length >= 8) break outer;
        }
      }
      // шаблону достаточно большинства слов запроса: «претензия продавцу» найдёт претензию о недостатках товара
      const needed = Math.max(1, Math.ceil(stems.length / 2));
      result.templates = templates
        .map((template) => {
          const text = normalize(`${template.title} ${template.summary} ${template.category}`);
          const title = normalize(template.title);
          const hits = stems.filter((part) => hasWord(text, part)).length;
          const inTitle = stems.filter((part) => hasWord(title, part)).length;
          // запрос целиком в названии («трудовой договор») важнее совпадения отдельных слов
          const whole = title.includes(withoutLaw) ? 10 : 0;
          return { template, score: hits * 2 + inTitle + whole, hits };
        })
        .filter((entry) => entry.hits >= needed)
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.template);
      result.tools = TOOLS.filter((tool) => stems.some((part) => tool.stems.some((toolStem) => part.startsWith(toolStem) || (part.length >= 4 && toolStem.startsWith(part)))));
    }
    result.articles = result.articles.slice(0, 6);
    result.templates = result.templates.slice(0, 4);
    return result;
  }

  return { search, findLaw, hasWord, ALIASES, TOOLS };
});
