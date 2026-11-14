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

  function citation(lawId, number) {
    return `ст. ${number} ${window.LAW_BASE.laws[lawId].short}`;
  }

  /** Абзац с подсвеченными словами поиска. */
  function paragraph(line, terms) {
    if (!terms || !terms.length) return h("p", {}, line);
    return h("p", {}, window.TextSearch.highlight(line, terms).map((part) => (part.hit ? h("mark", {}, part.text) : part.text)));
  }

  /** Блок над текстом статьи: какая редакция показана и выбор другой. */
  function editionsBar(lawId, number, versions, chosen, note, onChoose) {
    const { label, formatDate } = window.Editions;
    const first = versions[0];
    const children = [];
    if (versions.length === 1) {
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
    const dialog = document.getElementById("article-dialog");
    const lawLine = document.getElementById("article-law");
    const titleLine = document.getElementById("article-title");
    const bar = document.getElementById("article-editions");
    const body = document.getElementById("article-body");
    lawLine.textContent = `${law.name}, статья ${number}`;
    titleLine.textContent = article.title;
    bar.hidden = true;

    const scrollToMark = () => {
      const first = body.querySelector("mark");
      body.scrollTop = first ? Math.max(0, first.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 16) : 0;
    };
    const showVersion = (versions, version, note) => {
      titleLine.textContent = version.title;
      bar.replaceChildren(...editionsBar(lawId, number, versions, version, note, (other) => showVersion(versions, other, null)));
      bar.hidden = false;
      const lines = version.repealed ? [version.title] : version.text;
      // абзацы, которых не было в предыдущей редакции, отмечаются полосой слева
      const previous = versions[versions.indexOf(version) - 1];
      const before = new Set(previous && previous.text ? previous.text : []);
      const changed = (line) => Boolean(previous) && !version.repealed && !before.has(line);
      body.replaceChildren(...(lines && lines.length
        ? lines.map((line) => {
          const element = paragraph(line, options.terms);
          if (changed(line)) element.className = "changed";
          return element;
        })
        : [h("p", {}, "Текста этой статьи нет в базе. Откройте её в источнике.")]));
      if (lines && lines.some(changed)) {
        body.prepend(h("p", { class: "changed-legend" }, `Полосой отмечены абзацы, которые изменились или появились с ${window.Editions.formatDate(version.from)}.`));
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
        showVersion(found.versions, found.version, `Официальные редакции на портале начинаются с ${formatDate(found.since)}. Какой текст действовал ${day}, по ним установить нельзя. Показана самая ранняя известная редакция.`);
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
    const source = document.getElementById("article-source");
    source.href = article.url;
    source.textContent = "Открыть на официальном портале pravo.gov.ru";
    dialog.showModal();
  }

  // Значки рисуются линиями 24×24 и наследуют цвет текста
  const ICONS = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="1.5"/><path d="M7 14h10v6H7z"/>',
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

  document.getElementById("article-close").addEventListener("click", () => {
    document.getElementById("article-dialog").close();
  });

  window.UI = { h, icon, showArticle, citation, downloadFile, shortDateTime };
})();
