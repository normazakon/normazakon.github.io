/* Общие помощники интерфейса: создание элементов, окно со статьёй, скачивание файла. */
(function () {
  "use strict";

  /** Создаёт элемент. Текст вставляется как текст, поэтому чужой HTML не исполняется. */
  function h(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") element.className = value;
      else if (key.startsWith("on")) element.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "dataset") Object.assign(element.dataset, value);
      else if (key in element && key !== "list") element[key] = value;
      else element.setAttribute(key, value);
    }
    element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
    return element;
  }

  function lawArticle(lawId, number) {
    const law = window.LAW_BASE.laws[lawId];
    return { law, article: law && law.articles[number] };
  }

  /** Ссылка на статью для текста: «ст. 395 ГК РФ», у частей без номера своя: «преамбула Конституции РФ». */
  /** Ссылка «Сообщить об ошибке»: открывает переписку в Telegram с готовым началом сообщения.
      В текст попадает только то, что видно на странице (название шаблона или статьи и адрес), значения полей — никогда. */
  function reportHref(subject, hash) {
    const base = window.SITE && window.SITE.telegram;
    if (!base) return null;
    const page = `${location.origin}${location.pathname}${hash || ""}`;
    return `${base}?text=${encodeURIComponent(`${subject}\n${page}\n\nЧто не так: `)}`;
  }

  function reportLink(subject, hash, className = "link-button report-link") {
    const href = reportHref(subject, hash);
    return href ? h("a", { class: className, href, target: "_blank", rel: "noopener noreferrer" }, "Сообщить об ошибке") : null;
  }

  function citation(lawId, number) {
    const { law, article } = lawArticle(lawId, number);
    return article && article.cite ? article.cite : `ст. ${number} ${law.short}`;
  }

  /** То же с большой буквы, для подписи в списках: «Ст. 395 ГК РФ», «Преамбула Конституции РФ». */
  function articleName(lawId, number) {
    const text = citation(lawId, number);
    return text[0].toUpperCase() + text.slice(1);
  }

  /**
   * Абзац нормы: слова поиска подсвечены, ссылки на статьи из базы («статьей 395 настоящего Кодекса») нажимаются.
   * lawId: закон, в котором стоит абзац.
   */
  function paragraph(line, terms, lawId) {
    return h("p", {}, inline(line, terms, lawId));
  }

  /** Содержимое абзаца нормы или его куска: текст, подсветка слов поиска и кнопки-ссылки на статьи. */
  function inline(line, terms, lawId) {
    const marked = (text) => (terms && terms.length
      ? window.TextSearch.highlight(text, terms).map((part) => (part.hit ? h("mark", {}, part.text) : part.text))
      : [text]);
    const references = lawId && window.Checker ? window.Checker.findReferences(line, lawId, window.LAW_BASE) : [];
    const nodes = [];
    let position = 0;
    for (const reference of references) {
      nodes.push(...marked(line.slice(position, reference.start)));
      nodes.push(h("button", {
        class: "norm-ref", type: "button", title: `Открыть ${citation(reference.lawId, reference.number)}`,
        onClick: () => showArticle(reference.lawId, reference.number, { fromReference: true }),
      }, ...marked(line.slice(reference.start, reference.end))));
      position = reference.end;
    }
    nodes.push(...marked(line.slice(position)));
    return nodes;
  }

  // показывать ли правки словами; выбор запоминается в браузере
  const CHANGES_KEY = "norma.showChanges";
  let showChanges = true;
  try { showChanges = localStorage.getItem(CHANGES_KEY) !== "off"; } catch (error) { /* хранилище недоступно */ }

  /**
   * Текст редакции с правками относительно прежней: добавленное в <ins>, удалённое в <del>,
   * изменённые и новые абзацы отмечены полосой слева.
   */
  function diffParagraphs(ops, terms, lawId) {
    return ops.map((op) => {
      if (op.type === "same") return paragraph(op.text, terms, lawId);
      if (op.type === "added") return h("p", { class: "changed" }, h("ins", {}, inline(op.text, terms, lawId)));
      if (op.type === "removed") return h("p", { class: "changed" }, h("del", {}, op.text));
      return h("p", { class: "changed" }, op.parts.map((part) => {
        if (part.type === "added") return h("ins", {}, inline(part.text, terms, lawId));
        if (part.type === "removed") return h("del", {}, part.text);
        return inline(part.text, terms, lawId);
      }));
    });
  }

  const bookmarks = window.Bookmarks.createBookmarks(window.Storage2.browserBackend());

  /** Кнопка-звёздочка: добавляет в избранное или убирает. */
  function fillStar(button, item) {
    const active = bookmarks.isFavorite(item);
    button.setAttribute("aria-pressed", String(active));
    button.replaceChildren(icon("star"), active ? "В избранном" : "В избранное");
    button.querySelector(".icon").classList.toggle("filled", active);
  }

  function starButton(item, extraClass = "") {
    const button = h("button", { class: `button quiet star-button ${extraClass}`.trim(), type: "button" });
    button.addEventListener("click", () => { bookmarks.toggleFavorite(item); fillStar(button, item); });
    fillStar(button, item);
    return button;
  }

  // значок закона: короткая надпись и оттенок по виду акта
  const LAW_BADGES = {
    KONST: ["КРФ", "amber"],
    GK: ["ГК", "blue"], NK: ["НК", "blue"], TK: ["ТК", "blue"], JK: ["ЖК", "blue"], SK: ["СК", "blue"], ZK: ["ЗК", "blue"],
    GPK: ["ГПК", "violet"], APK: ["АПК", "violet"], KAS: ["КАС", "violet"], UPK: ["УПК", "violet"],
    UK: ["УК", "rose"], KOAP: ["КоАП", "orange"],
    ZOZPP: ["ЗПП", "teal"], FZ214: ["214", "teal"], FZ229: ["229", "teal"], FZ127: ["127", "teal"],
    FZ14: ["ООО", "green"], FZ208: ["АО", "green"], FZ218: ["218", "teal"], NOTAR: ["НОТ", "amber"],
    FZ40: ["ОСАГО", "teal"], FZ114: ["114", "teal"], FZ273: ["273", "teal"], FZ323: ["323", "teal"], FZ132: ["132", "teal"],
    FZ123: ["ФУ", "teal"], FZ59: ["59", "teal"], PROK: ["ПРК", "amber"],
    FZ353: ["353", "teal"], FZ230: ["230", "teal"], FZ152: ["ПД", "teal"],
  };

  /** Значок закона: короткая надпись на плашке своего оттенка. */
  function lawBadge(id, law, small) {
    const [text, tone] = LAW_BADGES[id] || [law.short.replace(/\s*РФ$/, ""), "blue"];
    return h("span", { class: `law-badge tone-${tone}${small ? " small" : ""}`, "aria-hidden": "true" }, text);
  }

  // у каждого раздела своя иконка и спокойный оттенок, чтобы разделы различались с первого взгляда
  const CATEGORY_LOOK = {
    "Договоры": ["contract", "blue"],
    "Соглашения и расписки": ["pen", "teal"],
    "Акты": ["listcheck", "green"],
    "Доверенности": ["stamp", "amber"],
    "Претензии и уведомления": ["letter", "orange"],
    "Суд": ["court", "violet"],
    "Трудовые отношения": ["briefcase", "rose"],
  };

  /** Иконка и оттенок раздела шаблонов: [имя иконки, оттенок]. */
  function templateLook(category) {
    return CATEGORY_LOOK[category] || ["contract", "blue"];
  }

  // статьи, из которых пришли по ссылкам: кнопка «Назад» возвращает к предыдущей
  let trail = [];
  let shown = null;

  /** Блок над текстом статьи: какая редакция показана и выбор другой. */
  function editionsBar(lawId, number, versions, chosen, note, onChoose) {
    const { label, formatDate } = window.Editions;
    const first = versions[0];
    const law = window.LAW_BASE.laws[lawId];
    const children = [];
    if (versions.length === 1 && law.source !== "pravo.gov.ru") {
      // Конституция: прежних текстов статей в источнике нет, известна только дата нынешнего текста
      children.push(h("p", {}, first.repealed
        ? `Утратила силу с ${formatDate(first.from)}.`
        : first.from === law.since
          ? `Действующая редакция. Текст не менялся с ${formatDate(first.from)}, дня вступления в силу.`
          : `Действующая редакция с ${formatDate(first.from)}. Прежнего текста статьи в базе нет.`));
    } else if (versions.length === 1) {
      children.push(h("p", {}, first.repealed
        ? `Утратила силу. Официальные редакции на портале есть с ${formatDate(first.from)}.`
        : `Действующая редакция. С ${formatDate(first.from)}, когда на портале начинаются официальные редакции, статья не менялась.`));
    } else {
      const select = h("select", { id: "article-edition", "aria-label": "Редакция статьи" },
        [...versions].reverse().map((version) => h("option", {
          value: version.from, selected: version === chosen,
        }, label(version))));
      select.addEventListener("change", () => onChoose(versions.find((version) => version.from === select.value)));
      children.push(h("label", { class: "edition-pick" }, h("span", {}, "Редакция"), select));
      if (chosen.future) children.push(h("span", { class: "badge" }, "Не вступила в силу"));
      else if (!chosen.current) children.push(h("span", { class: "badge draft" }, "Недействующая"));
    }
    const upcoming = versions.find((version) => version.future);
    if (upcoming && chosen.current && !note) {
      note = `С ${formatDate(upcoming.from)} вступает в силу новая редакция статьи, её можно выбрать в списке.`;
    }
    if (note) children.push(h("p", { class: "edition-note" }, note));
    return children;
  }

  /**
   * Открывает статью.
   * options.terms: слова поиска, которые нужно подсветить.
   * options.date: дата в формате ГГГГ-ММ-ДД, редакцию на которую нужно показать.
   */
  function showArticle(lawId, number, options = {}) {
    const { law, article } = lawArticle(lawId, number);
    if (!article) return;
    const { formatDate } = window.Editions;
    if (options.fromReference && shown) trail.push(shown);
    else if (!options.back) trail = [];
    shown = { lawId, number, date: options.date };
    const item = { kind: "article", lawId, number };
    bookmarks.touch(item);
    const star = document.getElementById("article-star");
    star.onclick = () => { bookmarks.toggleFavorite(item); fillStar(star, item); };
    fillStar(star, item);
    const back = document.getElementById("article-back");
    const previous = trail[trail.length - 1];
    back.hidden = !previous;
    back.textContent = previous ? `← Назад к ${citation(previous.lawId, previous.number)}` : "";
    const dialog = document.getElementById("article-dialog");
    const lawLine = document.getElementById("article-law");
    const titleLine = document.getElementById("article-title");
    const bar = document.getElementById("article-editions");
    const body = document.getElementById("article-body");
    // у статей Конституции нет заголовков: в окне вместо начала текста стоит номер статьи
    const titleOf = (version) => article.heading || (law.untitled ? `Статья ${number}` : version.title);
    lawLine.textContent = law.untitled ? law.name : `${law.name}, статья ${number}`;
    titleLine.textContent = titleOf(article);
    bar.hidden = true;

    // сначала к найденному слову поиска, иначе к первой правке; без них текст с начала
    const scrollToMark = () => {
      const first = body.querySelector("mark") || body.querySelector("p.changed");
      body.scrollTop = first ? Math.max(0, first.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 16) : 0;
    };
    const showVersion = (versions, version, note) => {
      titleLine.textContent = titleOf(version);
      bar.replaceChildren(...editionsBar(lawId, number, versions, version, note, (other) => showVersion(versions, other, null)));
      bar.hidden = false;
      const lines = version.repealed ? [version.title] : version.text;
      // правки считаются от предыдущей редакции: у будущей — от действующей
      const older = versions[versions.indexOf(version) - 1];
      const ops = older && !version.repealed && Array.isArray(older.text) && lines && lines.length
        ? window.TextDiff.paragraphs(older.text, lines)
        : null;
      const hasChanges = Boolean(ops && ops.some((op) => op.type !== "same"));
      if (!lines || !lines.length) {
        body.replaceChildren(h("p", {}, "Текста этой статьи нет в базе. Откройте её в источнике."));
      } else if (hasChanges && showChanges) {
        body.replaceChildren(...diffParagraphs(ops, options.terms, lawId));
      } else {
        // без правок изменённые и новые абзацы только отмечаются полосой слева
        const before = new Set(hasChanges ? older.text : lines);
        body.replaceChildren(...lines.map((line) => {
          const element = paragraph(line, options.terms, lawId);
          if (!before.has(line)) element.className = "changed";
          return element;
        }));
      }
      if (hasChanges) {
        const toggle = h("button", { class: "link-button", type: "button" }, showChanges ? "Скрыть правки" : "Показать правки");
        toggle.addEventListener("click", () => {
          showChanges = !showChanges;
          try { localStorage.setItem(CHANGES_KEY, showChanges ? "on" : "off"); } catch (error) { /* хранилище недоступно */ }
          showVersion(versions, version, note);
        });
        const since = formatDate(older.from);
        bar.append(h("p", { class: "diff-legend" }, showChanges
          ? ["Правки по сравнению с редакцией от ", since, ": ", h("ins", {}, "добавлено"), ", ", h("del", {}, "удалено"), ". "]
          : [`Полосой отмечены абзацы, изменённые по сравнению с редакцией от ${since}. `],
        toggle));
      }
      scrollToMark();
    };
    const fill = () => {
      const { at, history } = window.Editions;
      const base = window.LAW_BASE;
      const all = [window.LAW_EDITIONS, window.LAW_TEXTS];
      if (!options.date) {
        const versions = history(base, ...all, lawId, number);
        // последней в списке может быть ещё не вступившая в силу редакция, поэтому ищем действующую
        showVersion(versions, versions.find((version) => version.current), null);
        return;
      }
      const found = at(base, ...all, lawId, number, options.date);
      const day = formatDate(options.date);
      if (found.status === "absent") {
        const current = found.versions.find((version) => version.current);
        showVersion(found.versions, current, `На ${day} этой статьи ещё не было: она появилась ${formatDate(found.since)}. Показана действующая редакция.`);
      } else if (found.status === "unknown") {
        showVersion(found.versions, found.version, `Редакции этой статьи в базе начинаются с ${formatDate(found.since)}. Какой текст действовал ${day}, по ним установить нельзя. Показана самая ранняя известная редакция.`);
      } else {
        // у статьи без изменений блок и так говорит, что редакция одна
        showVersion(found.versions, found.version, found.versions.length > 1 ? `Редакция, которая действовала ${day}.` : null);
      }
    };

    body.replaceChildren(h("p", {}, "Загружаем текст статьи…"));
    const loads = [window.Editions.load(lawId)];
    if (article.hasText) loads.push(window.LawTexts.load(lawId));
    Promise.all(loads).then(fill).catch(() => {
      body.replaceChildren(h("p", {}, "Не удалось загрузить текст. Откройте статью в источнике."));
    });
    const report = document.getElementById("article-report");
    const reportTo = reportHref(`Ошибка в статье: ${articleName(lawId, number)} (${law.name})`, `#laws/${lawId}/${encodeURIComponent(number)}`);
    report.hidden = !reportTo;
    if (reportTo) report.href = reportTo;
    const source = document.getElementById("article-source");
    source.href = article.url;
    source.textContent = law.source === "pravo.gov.ru"
      ? "Открыть на официальном портале pravo.gov.ru"
      : `Открыть официальный текст на ${law.source}`;
    if (!dialog.open) dialog.showModal();
  }

  // Значки рисуются линиями 24×24 и наследуют цвет текста
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    building: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M4 21h16"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/>',
    contract: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    letter: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    court: '<path d="M12 3v18M5 21h14M6 7h12M6 7l-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2"/>',
    pen: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13 7 4 4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    stamp: '<path d="M9 13V9a3 3 0 1 1 6 0v4"/><path d="M5 13h14v4H5zM7 21h10"/>',
    listcheck: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  };

  /** Значок для кнопки или ссылки. Он только украшает, поэтому скрыт от экранного диктора. */
  function icon(name) {
    const holder = h("span", { class: "icon", "aria-hidden": "true" });
    holder.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    return holder;
  }

  function downloadFile(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type }));
    const link = h("a", { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function shortDateTime(iso) {
    return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  }

  document.getElementById("article-back").addEventListener("click", () => {
    const previous = trail.pop();
    if (previous) showArticle(previous.lawId, previous.number, { date: previous.date, back: true });
  });
  // событие закрытия приходит с задержкой: если окно уже открыли снова, историю переходов не сбрасываем
  document.getElementById("article-dialog").addEventListener("close", (event) => {
    if (event.target.open) return;
    trail = [];
    shown = null;
  });

  document.getElementById("article-close").addEventListener("click", () => {
    document.getElementById("article-dialog").close();
  });

  window.UI = { h, icon, showArticle, citation, articleName, downloadFile, shortDateTime, bookmarks, starButton, lawBadge, templateLook, reportLink, reportHref };
})();
