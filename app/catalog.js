/* Каталог шаблонов. */
(function () {
  "use strict";

  const { h } = window.UI;

  function basisLabel(template) {
    const byLaw = new Map();
    for (const { lawId, number } of template.basis) {
      byLaw.set(lawId, [...(byLaw.get(lawId) || []), number]);
    }
    return [...byLaw].map(([lawId, numbers]) => {
      const list = numbers.length > 3 ? `${numbers.slice(0, 3).join(", ")} и др.` : numbers.join(", ");
      return `ст. ${list} ${window.LAW_BASE.laws[lawId].short}`;
    }).join("; ");
  }

  const look = window.UI.templateLook;

  /** Карточка шаблона: иконка раздела, название, назначение и статьи, на которых он построен. */
  function templateCard(template) {
    const [iconName, tone] = look(template.category);
    return h("li", {}, h("a", { class: `catalog-card tone-${tone}`, href: `#template/${template.id}` },
      h("span", { class: "tone-plate" }, window.UI.icon(iconName)),
      h("span", { class: "catalog-title" }, template.title),
      h("span", { class: "catalog-summary" }, template.summary),
      h("span", { class: "catalog-basis" }, h("span", {}, basisLabel(template)), h("span", { class: "card-arrow" }, window.UI.icon("arrow")))));
  }

  const stemOf = (word) => window.TextSearch.stem(word);

  /** Шаблоны под запрос и разделы; без запроса остаётся исходный порядок. */
  function matching(query, category, kind) {
    const ranked = window.TemplateSearch.rank(window.TEMPLATES, query, { stem: stemOf, laws: window.LAW_BASE.laws });
    return ranked.filter((template) =>
      (!category || template.category === category) && (!kind || window.TemplateSearch.kindOf(template) === kind));
  }

  function renderGroups(matches, searching) {
    if (!matches.length) return [h("p", { class: "empty" }, "Такого шаблона пока нет. Попробуйте другое слово, раздел или вид документа.")];
    // при поиске лучшее совпадение вверху одним списком, без деления на разделы
    if (searching) return [h("ul", { class: "catalog-grid" }, matches.map(templateCard))];
    const categories = [...new Set(matches.map((template) => template.category))];
    return categories.map((name) => {
      const items = matches.filter((template) => template.category === name);
      return h("section", { class: "catalog-group" },
        h("h2", { class: `tone-${look(name)[1]}` }, h("span", { class: "tone-plate small" }, window.UI.icon(look(name)[0])), name, h("span", { class: "catalog-count" }, String(items.length))),
        h("ul", { class: "catalog-grid" }, items.map(templateCard)));
    });
  }

  window.Views = window.Views || {};
  window.Views.catalog = function (root, params = {}) {
    const known = new Set(window.TEMPLATES.map((template) => template.category));
    const total = window.TEMPLATES.length;
    // #templates/Суд открывает каталог сразу на нужном разделе
    const state = { category: known.has(params.category) ? params.category : null, kind: null };
    const results = h("div", {});
    const found = h("p", { class: "catalog-found", "aria-live": "polite" });
    const categoryRow = h("div", { class: "chips catalog-filter", role: "group", "aria-label": "Разделы шаблонов" });
    const kindRow = h("div", { class: "chips catalog-filter", role: "group", "aria-label": "Виды документов" });
    const search = h("input", {
      class: "search", type: "search", id: "template-search", placeholder: "Найти шаблон: слово, статья закона, вид документа", "aria-label": "Найти шаблон",
      onInput: () => update(),
    });

    const chip = (label, active, count, onClick) => h("button", {
      class: "chip", type: "button", "aria-pressed": String(active), onClick,
    }, label, h("span", { class: "chip-count" }, String(count)));

    function update() {
      const query = search.value;
      const searching = query.trim().length > 0;
      const matches = matching(query, state.category, state.kind);
      results.replaceChildren(...renderGroups(matches, searching));
      const filtered = searching || state.category || state.kind;
      found.textContent = filtered ? `Найдено ${matches.length} из ${total}` : "";
      // счетчики на кнопках считаются по запросу, но без самого фильтра этого ряда
      const byQuery = matching(query, null, null);
      const names = [...known];
      categoryRow.replaceChildren(
        chip("Все", !state.category, byQuery.filter((t) => !state.kind || window.TemplateSearch.kindOf(t) === state.kind).length, () => { state.category = null; update(); }),
        ...names.map((name) => chip(name, state.category === name,
          byQuery.filter((t) => t.category === name && (!state.kind || window.TemplateSearch.kindOf(t) === state.kind)).length,
          () => { state.category = name; update(); })));
      const kinds = window.TemplateSearch.KIND_ORDER.filter((kind) => byQuery.some((t) => window.TemplateSearch.kindOf(t) === kind));
      kindRow.replaceChildren(
        chip("Любой вид", !state.kind, byQuery.filter((t) => !state.category || t.category === state.category).length, () => { state.kind = null; update(); }),
        ...kinds.map((kind) => chip(kind, state.kind === kind,
          byQuery.filter((t) => window.TemplateSearch.kindOf(t) === kind && (!state.category || t.category === state.category)).length,
          () => { state.kind = kind; update(); })));
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Шаблоны документов"),
          h("p", {}, "Выберите документ и заполните поля: готовый текст появится рядом, его можно скачать. Ищите по слову, виду документа или статье закона.")),
        window.UI.templatesSwitch("templates")),
      h("div", { class: "forms-tools" }, search),
      h("p", { class: "filter-label" }, "Раздел"),
      categoryRow,
      h("p", { class: "filter-label" }, "Вид документа"),
      kindRow,
      found,
      results);
    update();
  };
})();
