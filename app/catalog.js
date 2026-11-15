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

  function renderGroups(query, category) {
    const needle = query.trim().toLowerCase();
    const matches = window.TEMPLATES.filter((template) =>
      (!category || template.category === category) && `${template.title} ${template.summary}`.toLowerCase().includes(needle));
    if (!matches.length) return [h("p", { class: "empty" }, "Такого шаблона пока нет. Попробуйте другое слово или раздел.")];
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
    // #templates/Суд открывает каталог сразу на нужном разделе
    let category = known.has(params.category) ? params.category : null;
    const results = h("div", {});
    const update = () => results.replaceChildren(...renderGroups(search.value, category));
    const search = h("input", {
      class: "search", type: "search", id: "template-search", placeholder: "Найти шаблон", "aria-label": "Найти шаблон",
      onInput: update,
    });
    const names = [...new Set(window.TEMPLATES.map((template) => template.category))];
    const chips = [[null, "Все"], ...names.map((name) => [name, name])].map(([value, label]) => h("button", {
      class: "chip", type: "button", "aria-pressed": String(value === category),
      onClick: () => {
        category = value;
        chips.forEach((chip, index) => chip.setAttribute("aria-pressed", String((index === 0 ? null : names[index - 1]) === category)));
        update();
      },
    }, label, h("span", { class: "chip-count" }, String(value ? window.TEMPLATES.filter((t) => t.category === value).length : window.TEMPLATES.length))));
    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Шаблоны документов"),
          h("p", {}, "Выберите документ и заполните поля: готовый текст появится рядом, его можно скачать в Word. Пустые места подсвечены, чтобы ничего не пропустить.")),
        search),
      h("div", { class: "chips catalog-filter", role: "group", "aria-label": "Разделы шаблонов" }, chips),
      results);
    update();
  };
})();
