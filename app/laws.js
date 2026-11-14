/* Просмотр и поиск статей в базе законов: по номеру и заголовку или по словам в тексте. */
(function () {
  "use strict";

  const { h, showArticle } = window.UI;
  const PAGE_SIZE = 100;
  const TEXT_DELAY_MS = 300;
  let mode = "title";

  /** 1 статья, 243 статьи, 1 736 статей. */
  function articlesCount(count) {
    const tens = count % 100;
    const units = count % 10;
    const word = tens >= 11 && tens <= 14 ? "статей" : units === 1 ? "статья" : units >= 2 && units <= 4 ? "статьи" : "статей";
    return `${count.toLocaleString("ru-RU")} ${word}`;
  }

  function compareNumbers(a, b) {
    const left = a.split(/[.-]/).map(Number);
    const right = b.split(/[.-]/).map(Number);
    for (let index = 0; index < Math.max(left.length, right.length); index++) {
      const difference = (left[index] ?? -1) - (right[index] ?? -1);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  function search(lawId, query) {
    const needle = query.trim().toLowerCase().replace(/^(ст\.?|статья)\s*/, "");
    const laws = window.LAW_BASE.laws;
    const ids = lawId ? [lawId] : Object.keys(laws);
    const isNumber = /^\d[\d.]*$/.test(needle);
    const matches = [];
    for (const id of ids) {
      for (const [number, article] of Object.entries(laws[id].articles)) {
        const found = isNumber ? number === needle || number.startsWith(`${needle}.`) : article.title.toLowerCase().includes(needle);
        if (found) matches.push({ lawId: id, number, article });
      }
    }
    return matches.sort((a, b) => ids.indexOf(a.lawId) - ids.indexOf(b.lawId) || compareNumbers(a.number, b.number));
  }

  function marked(text, terms) {
    return window.TextSearch.highlight(text, terms).map((part) => (part.hit ? h("mark", {}, part.text) : part.text));
  }

  function articleRow({ lawId, number, article, snippet }, showLaw, terms) {
    const flag = article.repealed
      ? h("span", { class: "article-flag repealed" }, "Утратила силу")
      : h("span", { class: "article-flag" }, article.hasText ? "Полный текст" : "Только заголовок");
    const law = window.LAW_BASE.laws[lawId];
    const title = h("span", {}, terms ? marked(article.title, terms) : article.title);
    const fragment = snippet && h("span", { class: "article-snippet" },
      marked(snippet.before, terms), h("mark", {}, snippet.match), marked(snippet.after, terms));
    return h("li", {}, h("button", {
      class: fragment ? "article-row with-snippet" : "article-row",
      type: "button",
      onClick: () => showArticle(lawId, number, { terms }),
    },
    h("span", { class: "article-number" }, showLaw ? `${number} ${law.short}` : `Ст. ${number}`),
    title,
    fragment ? null : flag,
    fragment));
  }

  /** Дерево оглавления из плоского списка [уровень, заголовок, [номера статей]]. */
  function tocTree(toc) {
    const root = { level: -1, children: [] };
    const stack = [root];
    for (const [level, title, numbers] of toc) {
      while (stack[stack.length - 1].level >= level) stack.pop();
      const node = { level, title, numbers, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    }
    return root.children;
  }

  function nodeCount(node) {
    return node.numbers.length + node.children.reduce((sum, child) => sum + nodeCount(child), 0);
  }

  /** Оглавление закона: разделы и главы раскрываются, статьи рисуются только при раскрытии. */
  function tocView(lawId) {
    const law = window.LAW_BASE.laws[lawId];
    const renderNode = (node) => {
      const body = h("div", { class: "toc-body" });
      const details = h("details", { class: `toc-node toc-level-${node.level}` },
        h("summary", {}, h("span", { class: "toc-title" }, node.title), h("span", { class: "toc-count" }, articlesCount(nodeCount(node)))),
        body);
      details.addEventListener("toggle", () => {
        if (!details.open || body.childElementCount) return;
        body.append(...node.children.map(renderNode));
        if (node.numbers.length) {
          body.append(h("ul", { class: "article-list" }, node.numbers
            .filter((number) => law.articles[number])
            .map((number) => articleRow({ lawId, number, article: law.articles[number] }, false, null))));
        }
      });
      return details;
    };
    return h("div", { class: "toc", "aria-label": `Оглавление: ${law.short}` }, tocTree(law.toc).map(renderNode));
  }

  /** Законы, по текстам которых можно искать. */
  function searchableLaws(lawId) {
    const laws = window.LAW_BASE.laws;
    const ids = lawId ? [lawId] : Object.keys(laws);
    return ids.filter((id) => Object.values(laws[id].articles).some((article) => article.hasText));
  }

  /** Загружает тексты законов по одному и сообщает, какой закон грузится. */
  async function loadTexts(ids, onProgress) {
    let done = ids.filter((id) => window.LawTexts.isLoaded(id)).length;
    for (const id of ids) {
      if (window.LawTexts.isLoaded(id)) continue;
      onProgress(done, ids.length, window.LAW_BASE.laws[id].short);
      await window.LawTexts.load(id);
      done++;
    }
  }

  /** Кнопка, которая сохраняет тексты всех законов для работы без интернета. */
  function offlinePanel() {
    if (!window.Pwa || !window.Pwa.offlineReady()) return null;
    const ids = searchableLaws(null);
    const status = h("p", { role: "status" });
    const button = h("button", { class: "button small", type: "button" }, window.UI.icon("download"), "Сохранить тексты");
    const describe = async () => {
      const saved = (await Promise.all(ids.map((id) => window.Pwa.isSaved(id)))).filter(Boolean).length;
      status.textContent = saved === ids.length
        ? "Тексты всех законов сохранены и доступны без интернета."
        : "Шаблоны и расчёты работают без интернета всегда. Тексты законов сохраняются, когда вы их открываете, или все сразу.";
      button.hidden = saved === ids.length;
    };
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await window.Pwa.saveAllTexts((done, total, name) => {
          if (done < total) status.textContent = `Сохраняем: ${name}, ${done + 1} из ${total}…`;
        });
      } catch (error) {
        status.textContent = "Не удалось загрузить тексты. Проверьте подключение к интернету и попробуйте ещё раз.";
        button.disabled = false;
        return;
      }
      button.disabled = false;
      button.hidden = true;
      status.textContent = "Тексты всех законов сохранены и доступны без интернета.";
    });
    describe();
    return h("section", { class: "offline-panel", "aria-label": "Работа без интернета" }, status, button);
  }

  window.Views = window.Views || {};
  window.Views.laws = function (root, params) {
    const laws = window.LAW_BASE.laws;
    const lawId = laws[params.lawId] ? params.lawId : null;
    const count = h("p", { class: "laws-count", role: "status" });
    const results = h("ul", { class: "article-list", id: "article-results" });
    // пока ничего не ищут и закон не выбран, вместо пустого места показываем сами законы
    const overview = h("ul", { class: "law-cards", hidden: true }, Object.entries(laws).map(([id, law]) => h("li", {},
      h("a", { class: "law-card", href: `#laws/${id}` },
        h("span", { class: "law-card-short" }, law.short),
        h("span", { class: "law-card-name" }, law.name),
        h("span", { class: "law-card-meta" },
          `${articlesCount(Object.keys(law.articles).length)} · редакция от ${window.Editions.formatDate(law.updated)}`)))));
    // у выбранного закона без запроса показываем оглавление вместо плоского списка статей
    const toc = lawId && laws[lawId].toc && laws[lawId].toc.length ? tocView(lawId) : null;
    if (toc) toc.hidden = true;
    const more = h("button", { class: "button laws-more", type: "button", hidden: true, onClick: () => { limit += PAGE_SIZE; render(); } }, "Показать ещё");
    let limit = PAGE_SIZE;
    let found = { matches: [], total: 0, terms: null };
    let timer = null;
    let request = 0;

    function render() {
      const query = input.value.trim();
      const shown = found.matches.slice(0, limit);
      more.hidden = shown.length === found.matches.length;
      results.hidden = shown.length === 0;
      results.replaceChildren(...shown.map((match) => articleRow(match, !lawId, found.terms)));
      overview.hidden = !(mode === "title" && !query && !lawId);
      if (toc) {
        const showToc = mode === "title" && !query;
        toc.hidden = !showToc;
        if (showToc) {
          results.hidden = true;
          more.hidden = true;
          count.textContent = "Оглавление. Раскройте раздел или главу либо найдите статью по номеру или слову из заголовка.";
          return;
        }
      }
      if (mode === "text" && !found.terms) {
        count.textContent = "Введите слова, которые должны встретиться в статье, например «неустойка потребитель».";
      } else if (mode === "title" && !query && !lawId) {
        count.textContent = "Введите номер статьи или слово из заголовка либо откройте закон.";
      } else if (!found.total) {
        count.textContent = mode === "text"
          ? "Ничего не найдено. Проверьте написание или уберите одно из слов."
          : "Ничего не найдено. Попробуйте другой номер или слово.";
      } else if (found.total > shown.length) {
        count.textContent = `Показано ${shown.length} из ${found.total.toLocaleString("ru-RU")}`;
      } else {
        count.textContent = `Найдено: ${found.total.toLocaleString("ru-RU")}`;
      }
    }

    function searchTitles() {
      const query = input.value.trim();
      const matches = query || lawId ? search(lawId, query) : [];
      found = { matches, total: matches.length, terms: null };
      render();
    }

    async function searchTexts() {
      const query = input.value.trim();
      const current = ++request;
      if (!window.TextSearch.queryTerms(query).length) {
        found = { matches: [], total: 0, terms: null };
        render();
        return;
      }
      const ids = searchableLaws(lawId);
      try {
        await loadTexts(ids, (done, total, name) => {
          if (current !== request) return;
          results.hidden = true;
          more.hidden = true;
          count.textContent = `Загружаем тексты законов: ${name}, ${done + 1} из ${total}…`;
        });
      } catch (error) {
        if (current === request) count.textContent = "Не удалось загрузить тексты законов. Проверьте подключение к интернету.";
        return;
      }
      if (current !== request) return;
      const sources = ids.map((id) => ({ lawId: id, articles: laws[id].articles, texts: window.LAW_TEXTS[id] }));
      const result = window.TextSearch.search(sources, query);
      found = {
        matches: result.matches.map((match) => ({ ...match, article: laws[match.lawId].articles[match.number] })),
        total: result.total,
        terms: result.terms,
      };
      render();
    }

    function update() {
      limit = PAGE_SIZE;
      clearTimeout(timer);
      if (mode === "title") searchTitles();
      else timer = setTimeout(searchTexts, TEXT_DELAY_MS);
    }

    const placeholders = { title: "Например, 395 или «неустойка»", text: "Например, «возврат товара»" };
    const input = h("input", {
      class: "search", type: "search", id: "law-search", "aria-label": "Поиск статьи", placeholder: placeholders[mode],
      onInput: update,
    });

    const hint = h("p", { class: "laws-hint", hidden: mode !== "text" },
      lawId
        ? "Показываем статьи, где встречаются все слова запроса, с любыми окончаниями."
        : "Ищем по всем законам. В первый раз тексты загружаются целиком, это может занять время. Чтобы искать быстрее, выберите закон в списке.");

    const modeButtons = [["title", "По номеру и названию"], ["text", "По словам в тексте"]].map(([value, label]) =>
      h("button", {
        type: "button",
        "aria-pressed": String(mode === value),
        dataset: { mode: value },
        onClick: () => {
          mode = value;
          modeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
          input.placeholder = placeholders[mode];
          hint.hidden = mode !== "text";
          found = { matches: [], total: 0, terms: null };
          request++;
          update();
          input.focus();
        },
      }, label));

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, lawId ? laws[lawId].name : "База законов"),
          h("p", {}, "Кодексы и законы в официальной редакции с портала pravo.gov.ru. Откройте закон или найдите статью по номеру или по словам."))),
      h("div", { class: lawId ? "laws-layout" : "laws-layout no-law" },
        h("div", { class: "laws-side" },
          h("nav", { "aria-label": "Законы" }, h("ul", { class: "law-list" }, Object.entries(laws).map(([id, law]) => h("li", {},
            h("a", { href: `#laws/${id}`, "aria-current": id === lawId ? "true" : undefined },
              law.short, h("span", {}, Object.keys(law.articles).length.toLocaleString("ru-RU"))))))),
          offlinePanel()),
        h("div", { class: "laws-main" },
          h("div", { class: "segmented laws-mode", role: "group", "aria-label": "Где искать" }, modeButtons),
          input, hint, count, results, overview, toc, more)));

    update();
    if (params.number && lawId) showArticle(lawId, params.number);
  };
})();
